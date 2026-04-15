import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('[events-processor] Starting event processing...');

    // 1️⃣ جلب الأحداث الجاهزة للمعالجة من integration_events
    const { data: events, error: fetchError } = await supabase
      .from('integration_events')
      .select('*')
      .eq('status', 'queued')
      .limit(50);

    if (fetchError) {
      console.error('[events-processor] Error fetching events:', fetchError);
      throw fetchError;
    }

    if (!events || events.length === 0) {
      console.log('[events-processor] No events to process');
      return new Response(
        JSON.stringify({ ok: true, processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[events-processor] Found ${events.length} events to process`);

    let processed = 0;
    let errors = 0;

    // 2️⃣ معالجة كل حدث
    for (const event of events) {
      try {
        // نقل الحدث إلى integration_outbox
        const { error: insertError } = await supabase
          .from('integration_outbox')
          .insert({
            event_type: event.event_name,
            payload: event.payload,
            status: 'pending',
            idempotency_key: event.idempotency_key,
          });

        if (insertError) {
          // إذا كان الخطأ بسبب تكرار idempotency_key، نعتبره نجاح
          if (insertError.code === '23505') {
            console.log(`[events-processor] Event already in outbox: ${event.idempotency_key}`);
          } else {
            throw insertError;
          }
        }

        // تحديث حالة الحدث في integration_events
        await supabase
          .from('integration_events')
          .update({ status: 'processed' })
          .eq('id', event.id);

        processed++;
        console.log(`[events-processor] Processed event: ${event.event_name}`);
      } catch (error) {
        errors++;
        console.error('[events-processor] Error processing event:', error);

        // تحديث حالة الحدث إلى error
        await supabase
          .from('integration_events')
          .update({ 
            status: 'error',
            last_error: error instanceof Error ? error.message : String(error)
          })
          .eq('id', event.id);
      }
    }

    console.log(`[events-processor] Completed: ${processed} processed, ${errors} errors`);

    return new Response(
      JSON.stringify({ ok: true, processed, errors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[events-processor] Fatal error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
