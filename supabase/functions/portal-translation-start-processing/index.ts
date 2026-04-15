import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Feature flag - in production, this would check payment first
const TRANSLATION_TEST_MODE = true;

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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { order_id } = body;

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: 'order_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership
    const { data: order, error: orderError } = await supabase
      .from('notarized_translation_orders')
      .select('id, customer_id, status')
      .eq('id', order_id)
      .eq('customer_id', user.id)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[START_PROCESSING] Order found:', { order_id, order_status: order.status });

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ✅ FIX: Get ALL jobs that have uploads (original_path is set)
    // In test mode, we process any job with an uploaded file
    // In production, we would require 'paid' status
    const { data: allJobs, error: allJobsError } = await serviceClient
      .from('notarized_translation_jobs')
      .select('id, status, original_path, page_count_locked')
      .eq('order_id', order_id);

    if (allJobsError) {
      console.error('[START_PROCESSING] Error fetching jobs:', allJobsError);
      return new Response(
        JSON.stringify({ error: allJobsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[START_PROCESSING] All jobs:', allJobs?.map(j => ({ id: j.id, status: j.status, hasOriginal: !!j.original_path })));

    // Filter jobs that are ready for processing
    // In TEST mode: any job with original_path that hasn't started processing
    // In PROD mode: only 'paid' jobs
    const eligibleStatuses = TRANSLATION_TEST_MODE 
      ? ['awaiting_payment', 'paid', 'awaiting_quote', 'quoted', 'quote_presented']
      : ['awaiting_payment', 'paid'];
    
    const jobs = (allJobs || []).filter(j => 
      j.original_path && 
      eligibleStatuses.includes(j.status) &&
      !j.status.startsWith('processing_')
    );

    console.log('[START_PROCESSING] Eligible jobs for processing:', jobs.length, jobs.map(j => ({ id: j.id, status: j.status })));

    if (!jobs || jobs.length === 0) {
      console.log('[START_PROCESSING] No jobs ready for processing. All jobs statuses:', allJobs?.map(j => j.status));
      
      // Check if jobs are already processing - if so, this is idempotent success
      const alreadyProcessing = (allJobs || []).filter(j => 
        j.status.startsWith('processing_') || 
        j.status === 'draft_ready' || 
        j.status === 'notarized_scan_ready' ||
        j.status === 'delivered'
      );
      
      if (alreadyProcessing.length > 0) {
        console.log('[START_PROCESSING] Jobs already processing, returning success (idempotent)');
        return new Response(
          JSON.stringify({ 
            ok: true, 
            idempotent: true,
            already_processing: alreadyProcessing.length,
            message: 'Jobs already in processing'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'No jobs ready for processing',
          debug: {
            total_jobs: allJobs?.length || 0,
            job_statuses: allJobs?.map(j => ({ id: j.id, status: j.status, hasOriginal: !!j.original_path })) || [],
            test_mode: TRANSLATION_TEST_MODE,
            eligible_statuses: eligibleStatuses
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // In test mode, mark order as paid first
    if (TRANSLATION_TEST_MODE) {
      console.log('[START_PROCESSING] Test mode: marking order as paid');
      const { error: markPaidError } = await serviceClient.rpc('rpc_notarized_order_mark_paid', {
        p_order_id: order_id,
        p_payment_ref: 'TEST_MODE'
      });
      if (markPaidError) {
        console.log('[START_PROCESSING] Note: rpc_notarized_order_mark_paid returned:', markPaidError.message);
        // Continue anyway - the RPC might not exist or order might already be paid
      }
    }

    // Enqueue each job
    const enqueuedJobs: string[] = [];
    const failedJobs: { id: string; error: string }[] = [];
    
    for (const job of jobs) {
      console.log('[START_PROCESSING] Enqueuing job:', job.id);
      const { error: enqueueError } = await serviceClient.rpc('rpc_notarized_job_enqueue', {
        p_job_id: job.id
      });

      if (!enqueueError) {
        enqueuedJobs.push(job.id);
        console.log('[START_PROCESSING] Job enqueued successfully:', job.id);
      } else {
        console.error('[START_PROCESSING] Failed to enqueue job:', job.id, enqueueError);
        failedJobs.push({ id: job.id, error: enqueueError.message });
      }
    }

    // Update order status to processing if any jobs were enqueued
    if (enqueuedJobs.length > 0) {
      const { error: updateError } = await serviceClient
        .from('notarized_translation_orders')
        .update({ status: 'processing' })
        .eq('id', order_id);
      
      if (updateError) {
        console.error('[START_PROCESSING] Failed to update order status:', updateError);
      }
    }

    console.log('[START_PROCESSING] Complete. Enqueued:', enqueuedJobs.length, 'Failed:', failedJobs.length);

    return new Response(
      JSON.stringify({ 
        ok: true, 
        enqueued_jobs: enqueuedJobs,
        failed_jobs: failedJobs,
        test_mode: TRANSLATION_TEST_MODE
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[START_PROCESSING] Error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
