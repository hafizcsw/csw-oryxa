/**
 * orx-control-panel — Super admin ORX ops + crawl control surface
 * 
 * Actions:
 *   summary        — counts by status/exposure + crawl queue stats
 *   entities       — full entities list with progress, facts, crawl status
 *   detail         — single entity deep detail + latest crawl job
 *   transition-fact — lifecycle transition for enrichment/dimension facts
 *   crawl-start    — start a crawl job for entity
 *   crawl-pause    — pause running job
 *   crawl-resume   — resume paused job
 *   crawl-cancel   — cancel job
 *   crawl-retry    — retry failed job
 *   crawl-rescore  — create rescore-only job
 *   crawl-repromote — create repromote-only job
 *   crawl-jobs     — get queue overview
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function getAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

async function requireAdminAuth(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return null;

  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await anonClient.auth.getUser();
  if (error || !user) return null;

  const srv = getAdminClient();
  const { data: isAdmin } = await srv.rpc('is_admin', { _user_id: user.id as any });
  if (!isAdmin) return null;

  return { user, srv };
}

function calculateProgress(row: any): number {
  const hasScore = row.status === 'scored' && row.score != null;
  const isRanked = hasScore && row.rank_global != null;
  const isSurfaceEligible = isRanked && row.exposure_status === 'beta_approved';

  if (isSurfaceEligible) return 100;
  if (isRanked) return 95;
  if (hasScore) return 90;
  if ((row.published_facts_count || 0) > 0) return 75;
  if ((row.approved_facts_count || 0) > 0) return 60;
  if ((row.candidate_facts_count || 0) > 0) return 40;
  if ((row.evidence_count || 0) > 0) return 20;
  return 0;
}

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const auth = await requireAdminAuth(req);
    if (!auth) return json({ ok: false, error: 'unauthorized' }, 401);

    const { user, srv } = auth;
    const url = new URL(req.url);
    
    let action = url.searchParams.get('action') || '';
    let bodyData: any = {};
    
    if (req.method === 'POST') {
      bodyData = await req.json().catch(() => ({}));
      if (!action && bodyData.action) action = bodyData.action;
    }

    // ── summary ──
    if (action === 'summary') {
      const [scoresRes, jobsRes] = await Promise.all([
        srv.from('orx_scores').select('status, exposure_status'),
        srv.from('orx_crawl_jobs').select('status'),
      ]);

      const summary = {
        total: 0, scored: 0, evaluating: 0, insufficient: 0,
        beta_candidate: 0, beta_approved: 0,
        blocked_missing_layer: 0, blocked_low_confidence: 0,
        blocked_uncalibrated: 0, internal_only: 0,
      };

      for (const s of (scoresRes.data || [])) {
        summary.total++;
        if (s.status === 'scored') summary.scored++;
        if (s.status === 'evaluating') summary.evaluating++;
        if (s.status === 'insufficient') summary.insufficient++;
        if (s.exposure_status === 'beta_candidate') summary.beta_candidate++;
        if (s.exposure_status === 'beta_approved') summary.beta_approved++;
        if (s.exposure_status === 'blocked_missing_layer') summary.blocked_missing_layer++;
        if (s.exposure_status === 'blocked_low_confidence') summary.blocked_low_confidence++;
        if (s.exposure_status === 'blocked_uncalibrated') summary.blocked_uncalibrated++;
        if (s.exposure_status === 'internal_only') summary.internal_only++;
      }

      // Crawl queue stats
      const crawlStats = { running: 0, queued: 0, paused: 0, failed: 0, completed: 0, cancelled: 0 };
      for (const j of (jobsRes.data || [])) {
        if (j.status in crawlStats) crawlStats[j.status as keyof typeof crawlStats]++;
      }

      return json({ ok: true, summary, crawl_stats: crawlStats });
    }

    // ── entities ──
    if (action === 'entities') {
      const [scoresRes, factsCountsRes, evidenceCountsRes, latestJobsRes] = await Promise.all([
        srv.from('orx_scores').select('*').order('updated_at', { ascending: false }),
        srv.from('entity_enrichment_facts').select('entity_id, status'),
        srv.from('orx_evidence').select('entity_id'),
        srv.from('orx_crawl_jobs').select('entity_id, status, current_stage, started_at, finished_at, last_heartbeat_at, last_error, pages_discovered, pages_fetched, pages_processed, pages_total_estimate, evidence_created, facts_created, score_updated, job_type, retry_count').order('created_at', { ascending: false }),
      ]);

      if (scoresRes.error) return json({ ok: false, error: scoresRes.error.message }, 500);

      const scores = scoresRes.data || [];

      // Facts map
      const factsMap: Record<string, { published: number; candidate: number; approved: number }> = {};
      for (const f of (factsCountsRes.data || [])) {
        if (!factsMap[f.entity_id]) factsMap[f.entity_id] = { published: 0, candidate: 0, approved: 0 };
        if (f.status === 'published') factsMap[f.entity_id].published++;
        if (f.status === 'candidate') factsMap[f.entity_id].candidate++;
        if (f.status === 'approved' || f.status === 'internal_approved') factsMap[f.entity_id].approved++;
      }

      // Evidence map
      const evidenceMap: Record<string, number> = {};
      for (const e of (evidenceCountsRes.data || [])) {
        evidenceMap[e.entity_id] = (evidenceMap[e.entity_id] || 0) + 1;
      }

      // Latest crawl job per entity (first occurrence since ordered desc)
      const latestJobMap: Record<string, any> = {};
      for (const j of (latestJobsRes.data || [])) {
        if (!latestJobMap[j.entity_id]) latestJobMap[j.entity_id] = j;
      }

      // Name resolution
      const uniIds = scores.filter((s: any) => s.entity_type === 'university' && uuidRegex.test(s.entity_id)).map((s: any) => s.entity_id);
      const progIds = scores.filter((s: any) => s.entity_type === 'program' && uuidRegex.test(s.entity_id)).map((s: any) => s.entity_id);
      const countryIds = scores.filter((s: any) => s.entity_type === 'country' && uuidRegex.test(s.entity_id)).map((s: any) => s.entity_id);

      const nameMap: Record<string, { name: string; country_code?: string }> = {};

      const [unisRes, progsRes, countriesRes] = await Promise.all([
        uniIds.length ? srv.from('universities').select('id, name, country_code').in('id', uniIds) : { data: [] },
        progIds.length ? srv.from('programs').select('id, title, school_name').in('id', progIds) : { data: [] },
        countryIds.length ? srv.from('countries').select('id, name_en, country_code').in('id', countryIds) : { data: [] },
      ]);

      for (const u of (unisRes.data || [])) nameMap[u.id] = { name: u.name, country_code: u.country_code };
      for (const p of (progsRes.data || [])) nameMap[p.id] = { name: p.title || p.school_name || p.id };
      for (const c of (countriesRes.data || [])) nameMap[c.id] = { name: c.name_en || c.id, country_code: c.country_code };

      for (const s of scores) {
        if (!nameMap[s.entity_id]) {
          nameMap[s.entity_id] = { name: s.entity_id.replace(/^__/, '').replace(/__$/, '').replace(/_/g, ' ') };
        }
      }

      const entities = scores.map((s: any) => {
        const facts = factsMap[s.entity_id] || { published: 0, candidate: 0, approved: 0 };
        const evidCount = evidenceMap[s.entity_id] || 0;
        const nm = nameMap[s.entity_id] || { name: s.entity_id };
        const latestJob = latestJobMap[s.entity_id] || null;

        const row = {
          ...s,
          entity_name: nm.name,
          country_code: nm.country_code || null,
          published_facts_count: facts.published,
          candidate_facts_count: facts.candidate,
          approved_facts_count: facts.approved,
          evidence_count: evidCount,
          progress_percent: 0,
          // Crawl job fields
          crawl_status: latestJob?.status || 'idle',
          crawl_stage: latestJob?.current_stage || null,
          crawl_started_at: latestJob?.started_at || null,
          crawl_finished_at: latestJob?.finished_at || null,
          crawl_last_heartbeat: latestJob?.last_heartbeat_at || null,
          crawl_last_error: latestJob?.last_error || null,
          crawl_pages_discovered: latestJob?.pages_discovered || 0,
          crawl_pages_fetched: latestJob?.pages_fetched || 0,
          crawl_pages_processed: latestJob?.pages_processed || 0,
          crawl_pages_total: latestJob?.pages_total_estimate || 0,
          crawl_evidence_created: latestJob?.evidence_created || 0,
          crawl_facts_created: latestJob?.facts_created || 0,
          crawl_score_updated: latestJob?.score_updated || false,
          crawl_job_type: latestJob?.job_type || null,
          crawl_retry_count: latestJob?.retry_count || 0,
        };
        row.progress_percent = calculateProgress(row);
        return row;
      });

      return json({ ok: true, entities });
    }

    // ── detail ──
    if (action === 'detail') {
      const entityId = url.searchParams.get('entity_id') || bodyData.entity_id;
      if (!entityId) return json({ ok: false, error: 'Missing entity_id' }, 400);

      const [scoreRes, factsRes, evidRes, dimFactsRes, jobsRes, auditRes] = await Promise.all([
        srv.from('orx_scores').select('*').eq('entity_id', entityId).maybeSingle(),
        srv.from('entity_enrichment_facts').select('*').eq('entity_id', entityId).order('updated_at', { ascending: false }),
        srv.from('orx_evidence').select('*').eq('entity_id', entityId).order('created_at', { ascending: false }).limit(20),
        srv.from('orx_dimension_facts').select('*').eq('entity_id', entityId).order('created_at', { ascending: false }).limit(50),
        srv.from('orx_crawl_jobs').select('*').eq('entity_id', entityId).order('created_at', { ascending: false }).limit(10),
        srv.from('orx_crawl_audit').select('*').eq('entity_id', entityId).order('created_at', { ascending: false }).limit(20),
      ]);

      const score = scoreRes.data;
      let entityName = entityId;
      if (score && uuidRegex.test(entityId)) {
        if (score.entity_type === 'university') {
          const { data: u } = await srv.from('universities').select('name, country_code').eq('id', entityId).maybeSingle();
          if (u) entityName = u.name;
        } else if (score.entity_type === 'program') {
          const { data: p } = await srv.from('programs').select('title, school_name').eq('id', entityId).maybeSingle();
          if (p) entityName = p.title || p.school_name || entityId;
        } else if (score.entity_type === 'country') {
          const { data: c } = await srv.from('countries').select('name_en').eq('id', entityId).maybeSingle();
          if (c) entityName = c.name_en || entityId;
        }
      } else if (score) {
        entityName = entityId.replace(/^__/, '').replace(/__$/, '').replace(/_/g, ' ');
      }

      const factsByStatus: Record<string, number> = {};
      for (const f of (factsRes.data || [])) factsByStatus[f.status] = (factsByStatus[f.status] || 0) + 1;

      const sourceDomains: string[] = [...new Set((evidRes.data || []).map((e: any) => e.source_domain).filter(Boolean))];

      const dimFactsByStatus: Record<string, number> = {};
      for (const d of (dimFactsRes.data || [])) dimFactsByStatus[d.status] = (dimFactsByStatus[d.status] || 0) + 1;

      const evidCount = (evidRes.data || []).length;
      const pubCount = factsByStatus['published'] || 0;
      const candCount = factsByStatus['candidate'] || 0;
      const appCount = (factsByStatus['internal_approved'] || 0) + (factsByStatus['approved'] || 0);

      const progressRow = { ...score, published_facts_count: pubCount, candidate_facts_count: candCount, approved_facts_count: appCount, evidence_count: evidCount };

      return json({
        ok: true,
        entity_name: entityName,
        score: score || null,
        progress_percent: calculateProgress(progressRow),
        facts_by_status: factsByStatus,
        dim_facts_by_status: dimFactsByStatus,
        source_domains: sourceDomains,
        evidence_count: evidCount,
        enrichment_facts: factsRes.data || [],
        dimension_facts: dimFactsRes.data || [],
        recent_evidence: evidRes.data || [],
        crawl_jobs: jobsRes.data || [],
        crawl_audit: auditRes.data || [],
      });
    }

    // ── transition-fact ──
    if (action === 'transition-fact') {
      const { fact_id, to_status, reason, fact_table } = bodyData;
      if (!fact_id || !to_status) return json({ ok: false, error: 'Missing fact_id or to_status' }, 400);

      const factIds = Array.isArray(fact_id) ? fact_id : [fact_id];
      const results: any[] = [];

      if (fact_table === 'enrichment') {
        for (const fid of factIds) {
          const { error } = await srv
            .from('entity_enrichment_facts')
            .update({ status: to_status, updated_at: new Date().toISOString() })
            .eq('id', fid);
          results.push({ fact_id: fid, result: error ? null : { ok: true }, error: error?.message });
        }
      } else {
        for (const fid of factIds) {
          const { data, error } = await srv.rpc('orx_transition_fact', {
            _fact_id: fid,
            _to_status: to_status,
            _transitioned_by: user.id,
            _reason: reason || null,
          });
          results.push({ fact_id: fid, result: data, error: error?.message });
        }
      }

      return json({ ok: true, results });
    }

    // ══════════════════════════════════════════════════
    // CRAWL OPERATIONS
    // ══════════════════════════════════════════════════

    // Helper: audit log
    async function auditLog(jobId: string | null, entityId: string, actionName: string, reason?: string, payload?: any) {
      await srv.from('orx_crawl_audit').insert({
        job_id: jobId,
        entity_id: entityId,
        action: actionName,
        actor: user.id,
        reason: reason || null,
        payload: payload || null,
      });
    }

    // ── crawl-start ──
    if (action === 'crawl-start') {
      const { entity_id, entity_type, job_type } = bodyData;
      if (!entity_id || !entity_type) return json({ ok: false, error: 'Missing entity_id or entity_type' }, 400);

      // Check no active job already running
      const { data: active } = await srv.from('orx_crawl_jobs')
        .select('id, status')
        .eq('entity_id', entity_id)
        .in('status', ['queued', 'running'])
        .limit(1);
      
      if (active && active.length > 0) {
        return json({ ok: false, error: 'Entity already has an active crawl job' }, 409);
      }

      const { data: job, error } = await srv.from('orx_crawl_jobs').insert({
        entity_id,
        entity_type,
        job_type: job_type || 'full',
        status: 'queued',
        current_stage: 'discover',
        triggered_by: user.id,
      }).select().single();

      if (error) return json({ ok: false, error: error.message }, 500);

      await auditLog(job.id, entity_id, 'crawl_started', `Job type: ${job_type || 'full'}`);
      return json({ ok: true, job });
    }

    // ── crawl-pause ──
    if (action === 'crawl-pause') {
      const { entity_id } = bodyData;
      if (!entity_id) return json({ ok: false, error: 'Missing entity_id' }, 400);

      const { data: job, error } = await srv.from('orx_crawl_jobs')
        .update({ status: 'paused', updated_at: new Date().toISOString() })
        .eq('entity_id', entity_id)
        .eq('status', 'running')
        .select().maybeSingle();

      if (error) return json({ ok: false, error: error.message }, 500);
      if (!job) return json({ ok: false, error: 'No running job found for this entity' }, 404);

      await auditLog(job.id, entity_id, 'crawl_paused');
      return json({ ok: true, job });
    }

    // ── crawl-resume ──
    if (action === 'crawl-resume') {
      const { entity_id } = bodyData;
      if (!entity_id) return json({ ok: false, error: 'Missing entity_id' }, 400);

      const { data: job, error } = await srv.from('orx_crawl_jobs')
        .update({ status: 'running', updated_at: new Date().toISOString() })
        .eq('entity_id', entity_id)
        .eq('status', 'paused')
        .select().maybeSingle();

      if (error) return json({ ok: false, error: error.message }, 500);
      if (!job) return json({ ok: false, error: 'No paused job found for this entity' }, 404);

      await auditLog(job.id, entity_id, 'crawl_resumed');
      return json({ ok: true, job });
    }

    // ── crawl-cancel ──
    if (action === 'crawl-cancel') {
      const { entity_id, reason } = bodyData;
      if (!entity_id) return json({ ok: false, error: 'Missing entity_id' }, 400);

      const { data: job, error } = await srv.from('orx_crawl_jobs')
        .update({ status: 'cancelled', finished_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('entity_id', entity_id)
        .in('status', ['queued', 'running', 'paused'])
        .select().maybeSingle();

      if (error) return json({ ok: false, error: error.message }, 500);
      if (!job) return json({ ok: false, error: 'No active job found to cancel' }, 404);

      await auditLog(job.id, entity_id, 'crawl_cancelled', reason);
      return json({ ok: true, job });
    }

    // ── crawl-retry ──
    if (action === 'crawl-retry') {
      const { entity_id, entity_type } = bodyData;
      if (!entity_id || !entity_type) return json({ ok: false, error: 'Missing entity_id or entity_type' }, 400);

      // Get the failed job to increment retry count
      const { data: failedJob } = await srv.from('orx_crawl_jobs')
        .select('retry_count')
        .eq('entity_id', entity_id)
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const retryCount = (failedJob?.retry_count || 0) + 1;

      // Mark old failed as cancelled
      await srv.from('orx_crawl_jobs')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('entity_id', entity_id)
        .eq('status', 'failed');

      const { data: job, error } = await srv.from('orx_crawl_jobs').insert({
        entity_id,
        entity_type,
        job_type: 'full',
        status: 'queued',
        current_stage: 'discover',
        retry_count: retryCount,
        triggered_by: user.id,
      }).select().single();

      if (error) return json({ ok: false, error: error.message }, 500);

      await auditLog(job.id, entity_id, 'crawl_retried', `Retry #${retryCount}`);
      return json({ ok: true, job });
    }

    // ── crawl-rescore ──
    if (action === 'crawl-rescore') {
      const { entity_id, entity_type } = bodyData;
      if (!entity_id || !entity_type) return json({ ok: false, error: 'Missing entity_id or entity_type' }, 400);

      const { data: job, error } = await srv.from('orx_crawl_jobs').insert({
        entity_id,
        entity_type,
        job_type: 'rescore',
        status: 'queued',
        current_stage: 'score',
        triggered_by: user.id,
      }).select().single();

      if (error) return json({ ok: false, error: error.message }, 500);

      await auditLog(job.id, entity_id, 'rescore_requested');
      return json({ ok: true, job });
    }

    // ── crawl-repromote ──
    if (action === 'crawl-repromote') {
      const { entity_id, entity_type } = bodyData;
      if (!entity_id || !entity_type) return json({ ok: false, error: 'Missing entity_id or entity_type' }, 400);

      const { data: job, error } = await srv.from('orx_crawl_jobs').insert({
        entity_id,
        entity_type,
        job_type: 'repromote',
        status: 'queued',
        current_stage: 'promote',
        triggered_by: user.id,
      }).select().single();

      if (error) return json({ ok: false, error: error.message }, 500);

      await auditLog(job.id, entity_id, 'repromote_requested');
      return json({ ok: true, job });
    }

    // ── crawl-jobs (queue overview) ──
    if (action === 'crawl-jobs') {
      const { data: jobs } = await srv.from('orx_crawl_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      return json({ ok: true, jobs: jobs || [] });
    }

    return json({ ok: false, error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
