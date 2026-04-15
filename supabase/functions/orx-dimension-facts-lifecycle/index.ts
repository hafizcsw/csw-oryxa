/**
 * orx-dimension-facts-lifecycle — Fact status transitions for ORX 2.0
 *
 * Supports: review, approve, reject, mark stale, supersede, publish.
 * All transitions enforced server-side via orx_transition_fact().
 *
 * Also provides:
 *   GET /ops-summary  — audit & readiness summaries
 */

import { createClient } from '@supabase/supabase-js';

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
    const action = url.searchParams.get('action') || '';

    // ── GET: ops-summary ──
    if (req.method === 'GET' && action === 'ops-summary') {
      const [audit, readiness, entityCov] = await Promise.all([
        srv.from('vw_orx_facts_audit_summary').select('*'),
        srv.from('vw_orx_dimension_readiness').select('*'),
        srv.from('vw_orx_entity_coverage').select('*').order('total_facts', { ascending: false }).limit(50),
      ]);

      return json({
        ok: true,
        audit_summary: audit.data || [],
        dimension_readiness: readiness.data || [],
        top_entities: entityCov.data || [],
      });
    }

    // ── GET: pending-review ──
    if (req.method === 'GET' && action === 'pending-review') {
      const domain = url.searchParams.get('domain');
      let query = srv.from('vw_orx_facts_pending_review').select('*');
      if (domain) query = query.eq('dimension_domain', domain);
      const { data, error } = await query.limit(100);
      return json({ ok: !error, facts: data || [], error: error?.message });
    }

    // ── GET: approved ──
    if (req.method === 'GET' && action === 'approved') {
      const { data } = await srv.from('vw_orx_facts_approved_unpublished').select('*').limit(100);
      return json({ ok: true, facts: data || [] });
    }

    // ── GET: readiness ──
    if (req.method === 'GET' && action === 'readiness') {
      const { data } = await srv.from('vw_orx_dimension_readiness').select('*');

      // Enrich with scorability assessment
      const REQUIRED_FAMILIES: Record<string, string[]> = {
        living: ['housing_availability', 'housing_affordability', 'transport_access', 'city_safety_context'],
        work_mobility: ['work_during_study_rights', 'post_study_work_pathway', 'degree_recognition_context'],
        roi: ['tuition_band', 'living_cost_band', 'scholarship_availability'],
      };

      const THRESHOLDS = { min_entities: 10, min_coverage: 50, min_comparability: 40, max_sparsity_pct: 30 };

      const readiness = (data || []).map((d: any) => {
        const required = REQUIRED_FAMILIES[d.dimension_domain] || [];
        const blockers: string[] = [];

        if (d.unique_entities < THRESHOLDS.min_entities) blockers.push(`Only ${d.unique_entities} entities (need ${THRESHOLDS.min_entities})`);
        if ((d.avg_coverage || 0) < THRESHOLDS.min_coverage) blockers.push(`Coverage ${Math.round(d.avg_coverage || 0)}% < ${THRESHOLDS.min_coverage}%`);
        if ((d.avg_comparability || 0) < THRESHOLDS.min_comparability) blockers.push(`Comparability ${Math.round(d.avg_comparability || 0)}% < ${THRESHOLDS.min_comparability}%`);
        if ((d.sparsity_pct || 0) > THRESHOLDS.max_sparsity_pct) blockers.push(`Sparsity ${Math.round(d.sparsity_pct)}% > ${THRESHOLDS.max_sparsity_pct}%`);
        if (d.fact_families_covered < required.length) blockers.push(`${d.fact_families_covered}/${required.length} required families covered`);

        return {
          ...d,
          scorable: blockers.length === 0,
          blockers,
        };
      });

      return json({ ok: true, readiness });
    }

    // ── POST: transition ──
    if (req.method === 'POST') {
      const body = await req.json();
      const { fact_id, to_status, reason } = body;

      if (!fact_id || !to_status) {
        return json({ ok: false, error: 'Missing fact_id or to_status' }, 400);
      }

      // Batch transitions
      const factIds = Array.isArray(fact_id) ? fact_id : [fact_id];
      if (factIds.length > 100) {
        return json({ ok: false, error: 'Max 100 transitions per batch' }, 400);
      }

      const results: any[] = [];
      for (const fid of factIds) {
        const { data, error } = await srv.rpc('orx_transition_fact', {
          _fact_id: fid,
          _to_status: to_status,
          _transitioned_by: user.id,
          _reason: reason || null,
        });

        results.push({
          fact_id: fid,
          result: data,
          error: error?.message,
        });
      }

      const accepted = results.filter(r => r.result?.ok).length;
      return json({
        ok: true,
        summary: { total: factIds.length, accepted, rejected: factIds.length - accepted },
        results,
      });
    }

    return json({ ok: false, error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
