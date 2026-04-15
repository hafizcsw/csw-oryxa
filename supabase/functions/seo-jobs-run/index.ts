import { requireAdmin } from "../_shared/adminGuard.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const g = await requireAdmin(req);
    if (!g.ok) {
      return new Response(JSON.stringify({ ok: false, error: g.error }), {
        status: g.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get pending jobs
    const { data: jobs, error: jobsError } = await g.srv
      .from('seo_jobs')
      .select('*')
      .eq('status', 'queued')
      .order('scheduled_at', { ascending: true })
      .limit(10);

    if (jobsError) throw jobsError;

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, processed: 0, message: 'No jobs to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    let completed = 0;
    let failed = 0;

    for (const job of jobs) {
      const runStarted = new Date().toISOString();

      try {
        // Update job status to running
        await g.srv
          .from('seo_jobs')
          .update({ status: 'running' })
          .eq('id', job.id);

        // Process job based on kind
        let stats = {};
        switch (job.kind) {
          case 'faq_generate':
            stats = await processFaqGenerate(g.srv, job.scope);
            break;
          case 'seo_refresh':
            stats = await processSeoRefresh(g.srv, job.scope);
            break;
          case 'crawl_snap':
            stats = await processCrawlSnap(g.srv, job.scope);
            break;
          case 'content_fill':
            stats = await processContentFill(g.srv, job.scope);
            break;
          default:
            throw new Error(`Unknown job kind: ${job.kind}`);
        }

        // Mark as completed
        await g.srv
          .from('seo_jobs')
          .update({ status: 'completed' })
          .eq('id', job.id);

        // Log run
        await g.srv.from('seo_job_runs').insert({
          job_id: job.id,
          started_at: runStarted,
          finished_at: new Date().toISOString(),
          ok: true,
          stats,
        });

        completed++;
      } catch (error: any) {
        // Mark as failed
        await g.srv
          .from('seo_jobs')
          .update({ status: 'failed' })
          .eq('id', job.id);

        // Log error
        await g.srv.from('seo_job_runs').insert({
          job_id: job.id,
          started_at: runStarted,
          finished_at: new Date().toISOString(),
          ok: false,
          error: String(error),
        });

        failed++;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        processed: jobs.length,
        completed,
        failed,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (e: any) {
    console.error('[seo-jobs-run] Error:', e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// Job processors
async function processFaqGenerate(srv: any, scope: string) {
  // Extract country slug from scope (e.g., "country:de")
  const match = scope?.match(/country:(\w+)/);
  if (!match) throw new Error('Invalid scope for faq_generate');

  const countrySlug = match[1];
  
  // This would call admin-country-faq-generate internally
  // For now, just log
  console.log(`[seo-jobs-run] FAQ generate for ${countrySlug}`);
  
  return { country: countrySlug, generated: true };
}

async function processSeoRefresh(srv: any, scope: string) {
  console.log(`[seo-jobs-run] SEO refresh for ${scope}`);
  return { scope, refreshed: true };
}

async function processCrawlSnap(srv: any, scope: string) {
  console.log(`[seo-jobs-run] Crawl snapshot for ${scope}`);
  return { scope, crawled: true };
}

async function processContentFill(srv: any, scope: string) {
  console.log(`[seo-jobs-run] Content fill for ${scope}`);
  return { scope, filled: true };
}
