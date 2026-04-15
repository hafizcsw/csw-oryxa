import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface EnrichJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused';
  total_universities: number;
  processed: number;
  enriched: number;
  programs_found: number;
  programs_saved: number;
  errors: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  last_activity_at: string | null;
  created_at: string;
}

const BATCH_SIZE = 1; // Process 1 university per invocation to stay under CPU limit
const DELAY_MS = 1500; // Delay between universities to avoid rate limiting

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { action = 'start', job_id, source = 'staging' } = body;

    console.log(`[uniranks-enrich-batch] Action: ${action}, Job: ${job_id}`);

    // Handle different actions
    if (action === 'start') {
      // Prevent multiple concurrent jobs for the same source
      const { data: existingJob } = await supabase
        .from('uniranks_enrich_jobs')
        .select('*')
        .eq('status', 'processing')
        .eq('source', source)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingJob) {
        return new Response(
          JSON.stringify({
            ok: true,
            job_id: existingJob.id,
            message: `Enrichment already running for source=${source}`,
            total: existingJob.total_universities,
            already_running: true,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Count universities to enrich
      let totalCount = 0;

      if (source === 'staging') {
        const { count } = await supabase
          .from('university_import_staging')
          .select('*', { count: 'exact', head: true })
          .eq('source', 'uniranks')
          .or('status.is.null,status.neq.enriched');
        
        totalCount = count || 0;
      } else if (source === 'universities') {
        const { count } = await supabase
          .from('universities')
          .select('*', { count: 'exact', head: true })
          .is('logo_url', null);
        
        totalCount = count || 0;
      }

      if (totalCount === 0) {
        return new Response(
          JSON.stringify({ ok: true, message: 'No universities to enrich' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create job record
      const { data: job, error: jobError } = await supabase
        .from('uniranks_enrich_jobs')
        .insert({
          status: 'processing',
          source,
          total_universities: totalCount,
          processed: 0,
          enriched: 0,
          programs_found: 0,
          programs_saved: 0,
          errors: 0,
          started_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (jobError) {
        // Table might not exist, create it inline
        if (jobError.code === '42P01') {
          throw new Error('uniranks_enrich_jobs table not found. Please run migration.');
        }
        throw jobError;
      }

      // Start background processing
      EdgeRuntime.waitUntil(processEnrichJob(supabase, job.id, source));

      return new Response(
        JSON.stringify({
          ok: true,
          job_id: job.id,
          message: `Started enrichment for ${totalCount} universities`,
          total: totalCount,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'status') {
      if (!job_id) {
        // Get latest job
        const { data: latestJob } = await supabase
          .from('uniranks_enrich_jobs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        return new Response(
          JSON.stringify({ ok: true, latest_job: latestJob }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: job } = await supabase
        .from('uniranks_enrich_jobs')
        .select('*')
        .eq('id', job_id)
        .single();

      return new Response(
        JSON.stringify({ ok: true, job }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'resume' && job_id) {
      // Resume a paused/failed job
      const { data: job } = await supabase
        .from('uniranks_enrich_jobs')
        .select('*')
        .eq('id', job_id)
        .single();

      if (!job) {
        throw new Error('Job not found');
      }

      if (job.status === 'completed') {
        return new Response(
          JSON.stringify({ ok: true, message: 'Job already completed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update status and continue
      await supabase
        .from('uniranks_enrich_jobs')
        .update({
          status: 'processing',
          error_message: null,
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', job_id);

      // Start background processing
      EdgeRuntime.waitUntil(processEnrichJob(supabase, job_id, job.source));

      return new Response(
        JSON.stringify({
          ok: true,
          message: `Resumed enrichment from position ${job.processed}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'pause') {
      let targetJobId = job_id as string | undefined;

      if (!targetJobId) {
        const { data: latestJob } = await supabase
          .from('uniranks_enrich_jobs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        targetJobId = latestJob?.id;
      }

      if (!targetJobId) {
        return new Response(
          JSON.stringify({ ok: true, message: 'No job to pause' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabase
        .from('uniranks_enrich_jobs')
        .update({
          status: 'paused',
          error_message: 'Paused by user',
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', targetJobId);

      return new Response(
        JSON.stringify({ ok: true, message: 'Job paused', job_id: targetJobId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error: any) {
    console.error('[uniranks-enrich-batch] Error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

/**
 * Process enrichment job in background
 */
async function processEnrichJob(supabase: any, jobId: string, source: string) {
  console.log(`[processEnrichJob] Starting job ${jobId}`);

  try {
    // Get current job state
    const { data: job } = await supabase
      .from('uniranks_enrich_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (!job || job.status !== 'processing') {
      console.log(`[processEnrichJob] Job ${jobId} not in processing state`);
      return;
    }

    // Get next university to process
    let nextUniversity: any = null;

    if (source === 'staging') {
      const { data } = await supabase
        .from('university_import_staging')
        .select('id, external_id, name')
        .eq('source', 'uniranks')
        .or('status.is.null,status.neq.enriched')
        .limit(1)
        .maybeSingle();
      
      nextUniversity = data;
    } else {
      const { data } = await supabase
        .from('universities')
        .select('id, slug, name')
        .is('logo_url', null)
        .limit(1)
        .maybeSingle();
      
      nextUniversity = data;
    }

    if (!nextUniversity) {
      // No more universities to process
      await supabase
        .from('uniranks_enrich_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      console.log(`[processEnrichJob] Job ${jobId} completed`);
      return;
    }

    console.log(`[processEnrichJob] Processing: ${nextUniversity.name || nextUniversity.external_id}`);

    // Call the enrich function
    const enrichPayload = source === 'staging'
      ? { staging_id: nextUniversity.id }
      : { university_id: nextUniversity.id, slug: nextUniversity.slug };

    const { data: enrichResult, error: enrichError } = await supabase.functions.invoke(
      'uniranks-enrich-university',
      { body: enrichPayload }
    );

    let updateData: any = {
      processed: job.processed + 1,
      last_activity_at: new Date().toISOString(),
    };

    if (enrichError || !enrichResult?.ok) {
      updateData.errors = job.errors + 1;
      console.error(`[processEnrichJob] Enrich failed:`, enrichError || enrichResult?.error);
    } else {
      updateData.enriched = job.enriched + 1;
      updateData.programs_found = job.programs_found + (enrichResult.programs_found || 0);
      updateData.programs_saved = job.programs_saved + (enrichResult.programs_saved || 0);
    }

    // Update job progress
    await supabase
      .from('uniranks_enrich_jobs')
      .update(updateData)
      .eq('id', jobId);

    // Check if we should continue (and respect pause)
    const { data: jobState } = await supabase
      .from('uniranks_enrich_jobs')
      .select('status')
      .eq('id', jobId)
      .single();

    if (jobState?.status !== 'processing') {
      console.log(`[processEnrichJob] Job ${jobId} is ${jobState?.status}; stopping chain`);
      return;
    }

    if (updateData.processed < job.total_universities) {
      // Add delay before next invocation
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));

      // Self-invoke to continue processing
      try {
        const { error: invokeError } = await supabase.functions.invoke('uniranks-enrich-batch', {
          body: { action: 'resume', job_id: jobId },
        });

        if (invokeError) {
          throw invokeError;
        }
      } catch (e: any) {
        const msg = e?.message || 'Unknown invoke error';
        console.error(`[processEnrichJob] Auto-resume failed:`, msg);
        await supabase
          .from('uniranks_enrich_jobs')
          .update({
            status: 'paused',
            error_message: `Auto-resume failed: ${msg}`,
            last_activity_at: new Date().toISOString(),
          })
          .eq('id', jobId);
      }
    } else {
      // Job complete
      await supabase
        .from('uniranks_enrich_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      console.log(`[processEnrichJob] Job ${jobId} completed`);
    }

  } catch (error: any) {
    console.error(`[processEnrichJob] Error:`, error);

    // Mark job as paused with error
    await supabase
      .from('uniranks_enrich_jobs')
      .update({
        status: 'paused',
        error_message: error.message,
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }
}
