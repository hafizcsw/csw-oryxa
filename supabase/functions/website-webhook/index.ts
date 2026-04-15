import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-oryxa-timestamp, x-oryxa-signature',
};

/**
 * Verify HMAC-SHA256 signature
 * Signature is calculated on: ${timestamp}.${rawBody}
 */
async function verifySignature(
  rawBody: string,
  timestamp: string | null,
  signature: string | null
): Promise<boolean> {
  const secret = Deno.env.get('HMAC_SHARED_SECRET') || Deno.env.get('CRM_WEBHOOK_SECRET') || '';
  
  if (!secret || !timestamp || !signature) {
    console.error('[website-webhook] Missing secret, timestamp, or signature');
    return false;
  }

  // Build the message: timestamp.body
  const message = `${timestamp}.${rawBody}`;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const rawSignature = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const expectedHex = Array.from(new Uint8Array(rawSignature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Handle both formats: plain hex or sha256=<hex>
  const providedHex = signature.startsWith('sha256=')
    ? signature.slice(7).toLowerCase()
    : signature.toLowerCase();

  const isValid = expectedHex === providedHex;
  
  if (!isValid) {
    console.error('[website-webhook] Signature mismatch');
    console.error('[website-webhook] Expected:', expectedHex.substring(0, 16) + '...');
    console.error('[website-webhook] Received:', providedHex.substring(0, 16) + '...');
  }

  return isValid;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  
  // ==========================================
  // CORS preflight
  // ==========================================
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ==========================================
  // GET: Health check
  // ==========================================
  if (req.method === 'GET') {
    console.log('[website-webhook] Health check');
    return new Response(
      JSON.stringify({ 
        ok: true, 
        service: 'website-webhook',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  // ==========================================
  // POST: Webhook receiver
  // ==========================================
  if (req.method === 'POST') {
    try {
      // Get headers
      const timestamp = req.headers.get('x-oryxa-timestamp');
      const signature = req.headers.get('x-oryxa-signature');

      // Read raw body for signature verification
      const rawBody = await req.text();

      // Verify signature
      if (!(await verifySignature(rawBody, timestamp, signature))) {
        console.error('[website-webhook] ❌ Invalid signature');
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log('[website-webhook] ✅ Signature verified');

      // Parse payload
      let payload: any;
      try {
        payload = JSON.parse(rawBody);
      } catch (e) {
        console.error('[website-webhook] Invalid JSON payload');
        return new Response(
          JSON.stringify({ error: 'Invalid JSON payload' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const { event, data, user_id, timestamp: eventTimestamp } = payload;

      console.log('[website-webhook] 📥 Received event:', event, '| user_id:', user_id);

      // Initialize Supabase client
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        { auth: { persistSession: false } }
      );

      // ==========================================
      // Handle different event types
      // ==========================================
      switch (event) {
        case 'status_changed': {
          // Application status update from CRM
          const { application_id, status, note, actor } = data || {};
          
          if (application_id && status) {
            // Insert status event
            await supabase.from('application_status_events').insert({
              application_id,
              status,
              note: note || null,
              created_by: actor || 'crm',
              channel: 'crm_webhook'
            });

            // Update application status
            await supabase.from('applications')
              .update({ status })
              .eq('id', application_id);

            console.log('[website-webhook] ✅ Status updated:', application_id, '->', status);
          }
          break;
        }

        case 'stage_updated': {
          // Student stage update
          const { profile_id, stage, progress, note } = data || {};
          
          if (profile_id && stage) {
            await supabase.from('profiles')
              .update({ 
                student_substage: stage,
                student_progress: progress || null
              })
              .eq('user_id', profile_id);

            // Add timeline event
            await supabase.from('student_timeline_events').insert({
              user_id: profile_id,
              event_type: 'stage_change',
              event_title: 'تحديث المرحلة',
              event_description: note || `تم تحديث مرحلتك إلى: ${stage}`,
              event_data: { stage, progress, source: 'crm' }
            });

            // Add notification
            await supabase.from('student_notifications').insert({
              user_id: profile_id,
              title: 'تحديث المرحلة',
              message: note || `تم تحديث مرحلتك إلى: ${stage}`,
              type: 'stage_update'
            });

            console.log('[website-webhook] ✅ Stage updated:', profile_id, '->', stage);
          }
          break;
        }

        case 'document_requested': {
          // Document request from counselor
          const { profile_id, doc_type, message } = data || {};
          
          if (profile_id) {
            await supabase.from('student_notifications').insert({
              user_id: profile_id,
              title: 'طلب مستند',
              message: message || `يرجى رفع: ${doc_type || 'مستند مطلوب'}`,
              type: 'document_request'
            });

            console.log('[website-webhook] ✅ Document requested for:', profile_id);
          }
          break;
        }

        case 'message_sent': {
          // New message from counselor
          const { profile_id, message, sender_name } = data || {};
          
          if (profile_id && message) {
            await supabase.from('student_notifications').insert({
              user_id: profile_id,
              title: sender_name ? `رسالة من ${sender_name}` : 'رسالة جديدة',
              message: message.substring(0, 200),
              type: 'new_message'
            });

            console.log('[website-webhook] ✅ Message notification sent to:', profile_id);
          }
          break;
        }

        case 'payment_confirmed': {
          // Payment confirmation
          const { profile_id, amount, currency, receipt_no } = data || {};
          
          if (profile_id) {
            await supabase.from('student_notifications').insert({
              user_id: profile_id,
              title: 'تأكيد الدفع',
              message: `تم تأكيد دفعتك بمبلغ ${amount} ${currency || 'USD'}`,
              type: 'payment_confirmed'
            });

            await supabase.from('student_timeline_events').insert({
              user_id: profile_id,
              event_type: 'payment',
              event_title: 'تأكيد الدفع',
              event_description: `تم تأكيد دفعتك بمبلغ ${amount} ${currency || 'USD'}`,
              event_data: { amount, currency, receipt_no, source: 'crm' }
            });

            console.log('[website-webhook] ✅ Payment confirmed for:', profile_id);
          }
          break;
        }

        case 'chat_reply': {
          // Chat reply from counselor/assistant
          const { session_id, content, sender } = data || {};
          
          if (session_id && content) {
            await supabase.from('chat_messages').insert({
              session_id,
              role: sender || 'assistant',
              content,
              meta: { source: 'crm_webhook' }
            });

            console.log('[website-webhook] ✅ Chat reply saved to session:', session_id);
          }
          break;
        }

        default:
          console.log('[website-webhook] ⚠️ Unknown event type:', event);
      }

      // Log the webhook event
      await supabase.from('events').insert({
        name: `webhook_${event || 'unknown'}`,
        properties: {
          event,
          user_id,
          timestamp: eventTimestamp,
          source: 'crm_webhook'
        }
      });

      return new Response(
        JSON.stringify({ ok: true, event }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );

    } catch (error) {
      console.error('[website-webhook] ❌ Error:', error);
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
  }

  // Method not allowed
  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    { 
      status: 405, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
});
