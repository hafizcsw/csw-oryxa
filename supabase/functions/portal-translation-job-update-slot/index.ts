import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Update the doc_slot of a job (so pricing updates accordingly).
 * Body: { job_id: string, doc_slot: string }
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, error: 'unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: 'unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const jobId = body.job_id;
    const newDocSlot = body.doc_slot;

    if (!jobId || !newDocSlot) {
      return new Response(
        JSON.stringify({ ok: false, error: 'job_id and doc_slot required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate doc_slot
    const validSlots = ['passport', 'certificate', 'transcript', 'residence', 'birth_certificate', 'diploma', 'medical', 'other'];
    if (!validSlots.includes(newDocSlot)) {
      return new Response(
        JSON.stringify({ ok: false, error: 'invalid doc_slot' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get job + order to verify ownership
    const { data: job, error: jobError } = await supabase
      .from('notarized_translation_jobs')
      .select('id, order_id, doc_slot, page_count_locked')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ ok: false, error: 'job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check ownership via order
    const { data: order, error: orderError } = await supabase
      .from('notarized_translation_orders')
      .select('id, customer_id, status')
      .eq('id', job.order_id)
      .eq('customer_id', user.id)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ ok: false, error: 'order not found or not yours' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Don't allow changes after quote is accepted / locked
    if (job.page_count_locked) {
      return new Response(
        JSON.stringify({ ok: false, error: 'cannot_change_after_lock' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update doc_slot
    const { error: updateError } = await supabase
      .from('notarized_translation_jobs')
      .update({ doc_slot: newDocSlot, updated_at: new Date().toISOString() })
      .eq('id', jobId);

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(
        JSON.stringify({ ok: false, error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[portal-translation-job-update-slot] Updated job ${jobId} to doc_slot=${newDocSlot}`);

    return new Response(
      JSON.stringify({ ok: true, job_id: jobId, doc_slot: newDocSlot }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
