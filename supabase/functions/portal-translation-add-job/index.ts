import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { order_id, doc_slot } = body;

    if (!order_id || !doc_slot) {
      return new Response(
        JSON.stringify({ error: 'order_id and doc_slot required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify order ownership
    const { data: order, error: orderError } = await supabase
      .from('notarized_translation_orders')
      .select('id, customer_id, status')
      .eq('id', order_id)
      .eq('customer_id', user.id)
      .single();

    if (orderError || !order) {
      console.error('[ADD_JOB] Order not found or not owned', { order_id, user_id: user.id, error: orderError });
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if job already exists for this slot
    const { data: existingJob } = await supabase
      .from('notarized_translation_jobs')
      .select('id')
      .eq('order_id', order_id)
      .eq('doc_slot', doc_slot)
      .maybeSingle();

    if (existingJob) {
      console.log('[ADD_JOB] Job already exists for slot', { order_id, doc_slot, job_id: existingJob.id });
      return new Response(
        JSON.stringify({ ok: true, job_id: existingJob.id, already_exists: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role to create job
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Insert new job
    const { data: newJob, error: insertError } = await serviceClient
      .from('notarized_translation_jobs')
      .insert({
        order_id,
        doc_slot,
        status: 'awaiting_upload'
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[ADD_JOB] Failed to create job', { order_id, doc_slot, error: insertError });
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[ADD_JOB] Created new job', { order_id, doc_slot, job_id: newJob.id });

    return new Response(
      JSON.stringify({ ok: true, job_id: newJob.id, already_exists: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[ADD_JOB] Error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
