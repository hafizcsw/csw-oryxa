/**
 * Geo Verification Orchestrator v2
 * 
 * Actions: create_job, start, tick, status, cancel
 * 
 * v2 changes:
 * - trace_id propagated to all workers
 * - telemetry at every stage
 * - bounded job support (max_rows)
 */
import { getSupabaseAdmin } from '../_shared/supabase.ts';
import { requireAdmin } from '../_shared/adminGuard.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-client-trace-id, x-orxya-ingress, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function respond(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function tlog(traceId: string, stage: string, status: string, extra: Record<string, any> = {}) {
  console.log(JSON.stringify({
    fn: 'geo-verify-orchestrator', trace_id: traceId,
    stage, status, ts: new Date().toISOString(), ...extra,
  }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization') ?? '';
  const apikeyHeader = req.headers.get('apikey') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '__none__';
  const srvKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '__none__';
  const isCron = authHeader.includes(anonKey) || authHeader.includes(srvKey) 
    || apikeyHeader === anonKey || apikeyHeader === srvKey;

  if (!isCron) {
    const check = await requireAdmin(req);
    if (!check.ok) return respond({ error: check.error }, check.status);
  }

  const supabase = getSupabaseAdmin();

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const traceId = body.trace_id || `gvo-${crypto.randomUUID().slice(0, 8)}`;

    // === CREATE JOB ===
    if (action === 'create_job') {
      const maxRows = body.max_rows ? Number(body.max_rows) : null;
      const countryFilter = body.country_code || null;
      const universityIds = body.university_ids || null; // explicit list for pilot

      tlog(traceId, 'create_job', 'start', { max_rows: maxRows, country_code: countryFilter, explicit_ids: universityIds?.length || 0 });

      let targetCount: number;

      if (universityIds && Array.isArray(universityIds) && universityIds.length > 0) {
        targetCount = universityIds.length;
      } else {
        let query = supabase
          .from('universities')
          .select('id', { count: 'exact', head: true })
          .not('website', 'is', null);
        if (countryFilter) query = query.eq('country_code', countryFilter);
        const { count: availableCount } = await query;
        targetCount = maxRows ? Math.min(maxRows, availableCount || 0) : (availableCount || 0);
      }

      const { data: job, error } = await supabase
        .from('geo_verification_jobs')
        .insert({
          status: 'pending',
          total_count: targetCount,
          filters: { max_rows: maxRows, country_code: countryFilter, university_ids: universityIds },
          created_by: 'admin',
        })
        .select()
        .single();

      if (error) {
        tlog(traceId, 'create_job', 'error', { error: error.message });
        return respond({ ok: false, error: error.message }, 400);
      }

      tlog(traceId, 'create_job', 'ok', { job_id: job.id, target_count: targetCount });
      return respond({ ok: true, job, target_count: targetCount, trace_id: traceId });
    }

    // === START: seed rows ===
    if (action === 'start') {
      const jobId = body.job_id;
      if (!jobId) return respond({ ok: false, error: 'job_id required' }, 400);

      tlog(traceId, 'start', 'begin', { job_id: jobId });

      const { data: jobData } = await supabase
        .from('geo_verification_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (!jobData) return respond({ ok: false, error: 'Job not found' }, 404);
      if (jobData.status !== 'pending') return respond({ ok: false, error: `Job status is ${jobData.status}, expected pending` }, 400);

      const filters = (jobData.filters as any) || {};
      const maxRows = filters.max_rows || jobData.total_count;
      const countryFilter = filters.country_code;
      const explicitIds: string[] | null = filters.university_ids;

      let unis: any[] = [];

      if (explicitIds && explicitIds.length > 0) {
        // Fetch by explicit IDs
        const { data, error } = await supabase
          .from('universities')
          .select('id, name, country_code, city')
          .in('id', explicitIds);
        if (error) return respond({ ok: false, error: error.message }, 500);
        unis = data || [];
      } else {
        let uniQuery = supabase
          .from('universities')
          .select('id, name, country_code, city')
          .not('website', 'is', null)
          .order('name')
          .limit(maxRows);
        if (countryFilter) uniQuery = uniQuery.eq('country_code', countryFilter);
        const { data, error } = await uniQuery;
        if (error) return respond({ ok: false, error: error.message }, 500);
        unis = data || [];
      }

      if (unis.length === 0) {
        await supabase.from('geo_verification_jobs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', jobId);
        tlog(traceId, 'start', 'empty', { job_id: jobId });
        return respond({ ok: true, seeded: 0 });
      }

      const rows = unis.map(u => ({
        job_id: jobId,
        university_id: u.id,
        university_name: u.name,
        current_country_code: u.country_code,
        current_city: u.city,
        status: 'pending',
      }));

      let seeded = 0;
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500);
        const { error: insertErr } = await supabase.from('geo_verification_rows').insert(batch);
        if (insertErr) {
          console.error('Seed batch error:', insertErr);
          tlog(traceId, 'seed_batch', 'error', { error: insertErr.message, offset: i });
          continue;
        }
        seeded += batch.length;
      }

      await supabase.from('geo_verification_jobs').update({
        status: 'running',
        total_count: seeded,
        started_at: new Date().toISOString(),
      }).eq('id', jobId);

      tlog(traceId, 'start', 'ok', { job_id: jobId, seeded });
      return respond({ ok: true, seeded, trace_id: traceId });
    }

    // === TICK: dispatch workers ===
    if (action === 'tick') {
      const jobId = body.job_id;
      if (!jobId) return respond({ ok: false, error: 'job_id required' }, 400);

      tlog(traceId, 'tick', 'begin', { job_id: jobId });

      const { data: jobData } = await supabase
        .from('geo_verification_jobs')
        .select('status, total_count, processed_count')
        .eq('id', jobId)
        .single();

      if (!jobData || jobData.status !== 'running') {
        return respond({ ok: false, error: 'Job not running' });
      }

      // Lock batch
      const { data: batch, error: lockErr } = await supabase
        .rpc('rpc_geo_lock_batch', { p_job_id: jobId, p_limit: 2, p_lease: `orch-${traceId}` });

      if (lockErr || !batch || batch.length === 0) {
        // Check if all done
        const { count: pendingCount } = await supabase
          .from('geo_verification_rows')
          .select('id', { count: 'exact', head: true })
          .eq('job_id', jobId)
          .in('status', ['pending', 'processing']);

        if ((pendingCount || 0) === 0) {
          const { data: statusCounts } = await supabase
            .from('geo_verification_rows')
            .select('status')
            .eq('job_id', jobId);

          const metrics: Record<string, number> = {};
          for (const r of (statusCounts || [])) {
            metrics[r.status] = (metrics[r.status] || 0) + 1;
          }

          await supabase.from('geo_verification_jobs').update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            processed_count: Object.values(metrics).reduce((a, b) => a + b, 0),
            verified_count: metrics['verified'] || 0,
            flagged_count: metrics['flagged'] || 0,
            unverifiable_count: metrics['unverifiable'] || 0,
            failed_count: metrics['failed'] || 0,
            metrics,
          }).eq('id', jobId);

          tlog(traceId, 'tick', 'completed', { job_id: jobId, metrics });
          return respond({ ok: true, done: true, metrics, trace_id: traceId });
        }

        tlog(traceId, 'tick', 'no_batch', { pending: pendingCount });
        return respond({ ok: true, dispatched: 0, pending: pendingCount });
      }

      tlog(traceId, 'tick', 'locked', { job_id: jobId, batch_size: batch.length, row_ids: batch.map((r: any) => r.id) });

      // Dispatch workers
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
      const SRV_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

      const dispatches = batch.map((row: any) =>
        fetch(`${SUPABASE_URL}/functions/v1/geo-verify-worker`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SRV_KEY}`,
          },
          body: JSON.stringify({
            university_id: row.university_id,
            job_id: jobId,
            row_id: row.id,
            trace_id: traceId,
          }),
        }).then(async (res) => {
          const body = await res.json().catch(() => ({}));
          tlog(traceId, 'worker_response', body.ok ? 'ok' : 'error', {
            university_id: row.university_id, row_id: row.id, worker_status: body.status, confidence: body.confidence,
          });
          return body;
        }).catch(err => {
          tlog(traceId, 'worker_dispatch', 'error', { university_id: row.university_id, error: err.message });
          return null;
        })
      );

      const results = await Promise.allSettled(dispatches);

      // Update processed count
      const { count: processedCount } = await supabase
        .from('geo_verification_rows')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', jobId)
        .neq('status', 'pending');

      await supabase.from('geo_verification_jobs').update({
        processed_count: processedCount || 0,
      }).eq('id', jobId);

      tlog(traceId, 'tick', 'dispatched', { job_id: jobId, dispatched: batch.length, processed_total: processedCount });
      return respond({ ok: true, dispatched: batch.length, processed: processedCount, trace_id: traceId });
    }

    // === STATUS ===
    if (action === 'status') {
      const jobId = body.job_id;
      if (jobId) {
        const { data: job } = await supabase.from('geo_verification_jobs').select('*').eq('id', jobId).single();
        const { data: rows } = await supabase.from('geo_verification_rows').select('id, university_id, university_name, status, confidence, issues, trace_id, locked_at, processed_at').eq('job_id', jobId).order('created_at');
        return respond({ ok: true, job, rows, trace_id: traceId });
      }
      const { data: jobs } = await supabase.from('geo_verification_jobs').select('*').order('created_at', { ascending: false }).limit(5);
      return respond({ ok: true, jobs });
    }

    // === CANCEL ===
    if (action === 'cancel') {
      const jobId = body.job_id;
      if (!jobId) return respond({ ok: false, error: 'job_id required' }, 400);
      await supabase.from('geo_verification_rows')
        .update({ status: 'failed', issues: ['cancelled'] })
        .eq('job_id', jobId).in('status', ['pending', 'processing']);
      await supabase.from('geo_verification_jobs').update({
        status: 'cancelled', completed_at: new Date().toISOString(),
      }).eq('id', jobId);
      tlog(traceId, 'cancel', 'ok', { job_id: jobId });
      return respond({ ok: true, cancelled: true, trace_id: traceId });
    }

    return respond({ ok: false, error: `Unknown action: ${action}` }, 400);

  } catch (err: any) {
    console.error(JSON.stringify({
      fn: 'geo-verify-orchestrator', stage: 'fatal', status: 'error',
      error: err.message, ts: new Date().toISOString(),
    }));
    return respond({ ok: false, error: err.message }, 500);
  }
});
