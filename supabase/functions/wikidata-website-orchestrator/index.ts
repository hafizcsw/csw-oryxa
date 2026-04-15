/**
 * Wikidata Website Enrichment Orchestrator (v7 – hard boundary)
 * 
 * Manages job lifecycle for Wikidata-based website discovery.
 * Actions: create_job, start, tick, status, cancel
 * 
 * HARD BOUNDARY: max_rows is enforced at creation, seeding, and tick.
 * If max_rows is provided, the job will contain EXACTLY that many rows.
 */
import { getSupabaseAdmin } from '../_shared/supabase.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-client-trace-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function respond(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getSupabaseAdmin();

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // === CREATE JOB ===
    if (action === 'create_job') {
      const maxRows = body.max_rows ? Number(body.max_rows) : null;

      // Count available targets
      const { count: availableCount } = await supabase
        .from('universities')
        .select('id', { count: 'exact', head: true })
        .is('website', null);

      const targetCount = maxRows || availableCount || 0;

      // If max_rows requested, verify enough targets exist
      if (maxRows && (availableCount || 0) < maxRows) {
        return respond({
          ok: false,
          error: `Requested max_rows=${maxRows} but only ${availableCount} universities without websites exist`,
        }, 400);
      }

      const { data: job, error } = await supabase
        .from('website_enrichment_jobs')
        .insert({
          status: 'queued',
          filter_criteria: { provider: 'wikidata', max_rows: maxRows },
          total_rows: targetCount,
          batch_size: body.batch_size || 25,
          provider_config: { providers: ['wikidata'] },
        })
        .select()
        .single();

      if (error) return respond({ ok: false, error: error.message }, 400);
      return respond({ ok: true, job, target_count: targetCount, max_rows: maxRows });
    }

    // === START: seed rows with hard boundary ===
    if (action === 'start') {
      const jobId = body.job_id;
      if (!jobId) return respond({ ok: false, error: 'job_id required' }, 400);

      // Read job to get max_rows
      const { data: jobData } = await supabase
        .from('website_enrichment_jobs')
        .select('id, status, filter_criteria')
        .eq('id', jobId)
        .single();

      if (!jobData) return respond({ ok: false, error: 'Job not found' }, 404);
      if (jobData.status !== 'queued') return respond({ ok: false, error: `Job status is ${jobData.status}, expected queued` }, 400);

      const filterCriteria = jobData.filter_criteria as any;
      const maxRows: number | null = filterCriteria?.max_rows || null;

      // Update status
      await supabase
        .from('website_enrichment_jobs')
        .update({ status: 'running', started_at: new Date().toISOString() })
        .eq('id', jobId);

      // Seed rows – respect maxRows hard limit
      let totalSeeded = 0;
      let offset = 0;
      const SEED_BATCH = 500;

      while (true) {
        // If max_rows set, don't fetch more than needed
        const remaining = maxRows ? maxRows - totalSeeded : SEED_BATCH;
        if (maxRows && remaining <= 0) break;

        const fetchSize = Math.min(SEED_BATCH, remaining);

        const { data: unis } = await supabase
          .from('universities')
          .select('id, name, country_id')
          .is('website', null)
          .order('id')
          .range(offset, offset + fetchSize - 1);

        if (!unis || unis.length === 0) break;

        // Get country codes
        const countryIds = [...new Set(unis.map(u => u.country_id).filter(Boolean))];
        const { data: countries } = await supabase
          .from('countries')
          .select('id, country_code')
          .in('id', countryIds);

        const countryMap = new Map((countries || []).map(c => [c.id, c.country_code]));

        const rows = unis.map(u => ({
          job_id: jobId,
          university_id: u.id,
          university_name: u.name,
          country_code: countryMap.get(u.country_id) || null,
          enrichment_status: 'pending',
          match_source: 'wikidata',
        }));

        await supabase.from('website_enrichment_rows').insert(rows);
        totalSeeded += unis.length;
        offset += fetchSize;
        console.log(`[wikidata-orch] Seeded ${totalSeeded}/${maxRows || 'all'} rows`);
      }

      // POST-SEED VERIFICATION: hard boundary check
      const { count: actualSeeded } = await supabase
        .from('website_enrichment_rows')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', jobId);

      if (maxRows && actualSeeded !== maxRows) {
        // ABORT: seeded count does not match requested max_rows
        console.error(`[wikidata-orch] BOUNDARY VIOLATION: seeded ${actualSeeded} but max_rows=${maxRows}. Aborting job.`);
        await supabase
          .from('website_enrichment_jobs')
          .update({ status: 'failed', completed_at: new Date().toISOString() })
          .eq('id', jobId);
        // Purge rows
        await supabase
          .from('website_enrichment_rows')
          .delete()
          .eq('job_id', jobId);
        return respond({
          ok: false,
          error: `Boundary violation: seeded ${actualSeeded} rows but max_rows=${maxRows}. Job aborted and rows purged.`,
        }, 400);
      }

      // Update total
      await supabase
        .from('website_enrichment_jobs')
        .update({ total_rows: actualSeeded || totalSeeded, last_activity_at: new Date().toISOString() })
        .eq('id', jobId);

      return respond({ ok: true, message: 'Job started', total_seeded: actualSeeded, max_rows: maxRows, boundary_verified: true });
    }

    // === TICK: dispatch worker with boundary checks ===
    if (action === 'tick') {
      const jobId = body.job_id;
      if (!jobId) return respond({ ok: false, error: 'job_id required' }, 400);

      // Check job is running and verify boundary
      const { data: job } = await supabase
        .from('website_enrichment_jobs')
        .select('id, status, batch_size, total_rows, filter_criteria')
        .eq('id', jobId)
        .single();

      if (!job || job.status !== 'running') {
        return respond({ ok: true, message: 'Job not running, no-op', status: job?.status });
      }

      // Boundary check: verify row count matches expected total
      const filterCriteria = job.filter_criteria as any;
      const maxRows = filterCriteria?.max_rows;

      if (maxRows) {
        const { count: rowCount } = await supabase
          .from('website_enrichment_rows')
          .select('id', { count: 'exact', head: true })
          .eq('job_id', jobId);

        if (rowCount !== maxRows) {
          console.error(`[wikidata-orch] TICK BOUNDARY VIOLATION: job has ${rowCount} rows but max_rows=${maxRows}. Refusing to tick.`);
          return respond({
            ok: false,
            error: `Boundary violation at tick: ${rowCount} rows vs max_rows=${maxRows}`,
          }, 400);
        }
      }

      const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
      const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const CONCURRENCY = job.batch_size && job.batch_size >= 50 ? 3 : 2;

      // Dispatch parallel workers for speed
      const workerPromises = Array.from({ length: CONCURRENCY }, () =>
        fetch(`${SUPABASE_URL}/functions/v1/website-enrich-worker`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_KEY}`,
          },
          body: JSON.stringify({ job_id: jobId }),
        }).then(r => r.json()).catch(e => ({ error: String(e) }))
      );

      const results = await Promise.all(workerPromises);

      // Check completion — all workers report done
      const allDone = results.every((r: any) => r.done === true);
      if (allDone) {
        await supabase
          .from('website_enrichment_jobs')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', jobId);
      }

      // Update counters
      const { count: matchedCount } = await supabase
        .from('website_enrichment_rows')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', jobId)
        .eq('enrichment_status', 'matched');

      const { count: reviewCount } = await supabase
        .from('website_enrichment_rows')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', jobId)
        .eq('enrichment_status', 'review');

      const { count: failedCount } = await supabase
        .from('website_enrichment_rows')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', jobId)
        .eq('enrichment_status', 'failed');

      const { count: pendingCount } = await supabase
        .from('website_enrichment_rows')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', jobId)
        .eq('enrichment_status', 'pending');

      const processed = (matchedCount || 0) + (reviewCount || 0) + (failedCount || 0);

      await supabase
        .from('website_enrichment_jobs')
        .update({
          processed_rows: processed,
          matched_rows: matchedCount || 0,
          review_rows: reviewCount || 0,
          failed_rows: failedCount || 0,
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      return respond({
        ok: true,
        workers: results,
        concurrency: CONCURRENCY,
        counters: { matched: matchedCount, review: reviewCount, failed: failedCount, pending: pendingCount },
        done: allDone,
      });
    }

    // === STATUS ===
    if (action === 'status') {
      const jobId = body.job_id;
      if (!jobId) {
        const { data: jobs } = await supabase
          .from('website_enrichment_jobs')
          .select('*')
          .contains('filter_criteria', { provider: 'wikidata' })
          .order('created_at', { ascending: false })
          .limit(10);
        return respond({ ok: true, jobs });
      }

      const { data: job } = await supabase
        .from('website_enrichment_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      const { data: breakdown } = await supabase
        .from('website_enrichment_rows')
        .select('enrichment_status')
        .eq('job_id', jobId);

      const counts: Record<string, number> = {};
      for (const r of (breakdown || [])) {
        counts[r.enrichment_status] = (counts[r.enrichment_status] || 0) + 1;
      }

      return respond({ ok: true, job, status_breakdown: counts });
    }

    // === CANCEL ===
    if (action === 'cancel') {
      const jobId = body.job_id;
      await supabase
        .from('website_enrichment_jobs')
        .update({ status: 'cancelled', completed_at: new Date().toISOString() })
        .eq('id', jobId);
      return respond({ ok: true, message: 'Job cancelled' });
    }

    return respond({ ok: false, error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    console.error('[wikidata-orch] Fatal:', err);
    return respond({ ok: false, error: String(err) }, 500);
  }
});
