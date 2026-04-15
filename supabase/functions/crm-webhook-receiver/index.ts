import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};


interface CRMWebhookPayload {
  web_user_id: string;
  event: 'status_changed' | 'stage_updated' | 'document_requested' | 'message_sent' | 'chat.reply';
  application_id?: string;
  new_status?: string;
  new_stage?: string;
  new_progress?: number;
  message?: string;
  data?: Record<string, any>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const expectedSecret = Deno.env.get('CRM_WEBHOOK_SECRET');
    if (!expectedSecret) {
      console.error('[crm-webhook] CRM_WEBHOOK_SECRET is not configured');
      return new Response(
        JSON.stringify({ error: 'Webhook not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1️⃣ التحقق من webhook secret
    const secret = req.headers.get('x-webhook-secret');
    if (!secret || secret !== expectedSecret) {
      console.warn('[crm-webhook] Unauthorized request - invalid secret');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: CRMWebhookPayload = await req.json();
    console.log('[crm-webhook] Received:', {
      event: payload.event,
      web_user_id: payload.web_user_id,
      application_id: payload.application_id
    });

    // 2️⃣ Validation
    if (!payload.web_user_id) {
      return new Response(
        JSON.stringify({ error: 'web_user_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 3️⃣ معالجة الأحداث المختلفة
    switch (payload.event) {
      case 'status_changed':
        // تحديث حالة الطلب
        if (payload.application_id && payload.new_status) {
          await supabase
            .from('applications')
            .update({ status: payload.new_status })
            .eq('id', payload.application_id)
            .eq('user_id', payload.web_user_id);

          console.log('[crm-webhook] Updated application status:', {
            application_id: payload.application_id,
            new_status: payload.new_status
          });

          // إضافة timeline event
          await supabase
            .from('student_timeline_events')
            .insert({
              user_id: payload.web_user_id,
              event_type: 'status_change',
              event_title: 'تحديث حالة الطلب',
              event_description: `تم تحديث حالة طلبك إلى: ${payload.new_status}`,
              event_data: {
                application_id: payload.application_id,
                new_status: payload.new_status,
                source: 'crm'
              },
            });

          // إضافة notification
          await supabase
            .from('student_notifications')
            .insert({
              user_id: payload.web_user_id,
              title: 'تحديث حالة الطلب',
              message: payload.message || `تم تحديث حالة طلبك`,
              type: 'status_update',
            });
        }
        break;

      case 'stage_updated':
        // تحديث مرحلة الطالب (من 10 مراحل CRM)
        if (payload.new_stage) {
          await supabase
            .from('profiles')
            .update({
              student_substage: payload.new_stage,
              student_progress: payload.new_progress || null,
            })
            .eq('user_id', payload.web_user_id);

          console.log('[crm-webhook] Updated student stage:', {
            web_user_id: payload.web_user_id,
            new_stage: payload.new_stage,
            progress: payload.new_progress
          });

          // إضافة timeline event
          await supabase
            .from('student_timeline_events')
            .insert({
              user_id: payload.web_user_id,
              event_type: 'stage_change',
              event_title: 'تحديث المرحلة',
              event_description: payload.message || `تم تحديث مرحلتك في عملية التقديم`,
              event_data: {
                new_stage: payload.new_stage,
                progress: payload.new_progress,
                source: 'crm'
              },
            });

          // إضافة notification
          await supabase
            .from('student_notifications')
            .insert({
              user_id: payload.web_user_id,
              title: 'تحديث المرحلة',
              message: payload.message || `تم تحديث مرحلتك في عملية التقديم`,
              type: 'stage_update',
            });
        }
        break;

      case 'document_requested':
        // طلب مستند جديد
        await supabase
          .from('student_notifications')
          .insert({
            user_id: payload.web_user_id,
            title: 'مستند مطلوب',
            message: payload.message || 'يرجى رفع المستندات المطلوبة',
            type: 'document_request',
          });

        // إضافة timeline event
        await supabase
          .from('student_timeline_events')
          .insert({
            user_id: payload.web_user_id,
            event_type: 'document_request',
            event_title: 'مستند مطلوب',
            event_description: payload.message || 'تم طلب مستندات إضافية',
            event_data: {
              ...payload.data,
              source: 'crm'
            },
          });

        console.log('[crm-webhook] Document requested:', payload.web_user_id);
        break;

      case 'message_sent':
        // رسالة جديدة من المستشار
        await supabase
          .from('student_notifications')
          .insert({
            user_id: payload.web_user_id,
            title: 'رسالة جديدة',
            message: payload.message || 'لديك رسالة جديدة من مستشارك',
            type: 'message',
          });

        console.log('[crm-webhook] Message sent:', payload.web_user_id);
        break;

      case 'chat.reply':
        // 🔥 رد من Malak (المستشار) في CRM - نرسله للبوت
        if (payload.data?.session_id && payload.message) {
          // حفظ رسالة Malak في chat_messages
          await supabase
            .from('chat_messages')
            .insert({
              session_id: payload.data.session_id,
              role: 'assistant',
              content: payload.message,
              meta: {
                from_crm: true,
                counselor: 'malak',
                timestamp: new Date().toISOString(),
              },
            });

          console.log('[crm-webhook] Malak reply saved to chat:', {
            session_id: payload.data.session_id,
            message_preview: payload.message.substring(0, 50)
          });

          // إرسال notification للطالب
          await supabase
            .from('student_notifications')
            .insert({
              user_id: payload.web_user_id,
              title: 'رد من المستشارة',
              message: payload.message,
              type: 'message',
            });
        }
        break;

      default:
        console.warn('[crm-webhook] Unknown event type:', payload.event);
    }

    // 4️⃣ Log the webhook للمراجعة
    await supabase.from('events').insert({
      name: 'crm_webhook_received',
      properties: {
        event: payload.event,
        web_user_id: payload.web_user_id,
        application_id: payload.application_id,
        data: payload.data
      },
    });

    return new Response(
      JSON.stringify({ ok: true, event_processed: payload.event }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[crm-webhook] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
