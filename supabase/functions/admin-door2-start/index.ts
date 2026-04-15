import { handleCorsPreflight, getCorsHeaders, generateTraceId, slog } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/adminGuard.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * admin-door2-start: Seeds uniranks_crawl_state + enables Door2
 * POST { pilot_limit?: number, source?: "uniranks" | "qs" }
 *
 * Source-agnostic seeding:
 *   - uniranks: seeds from universities.uniranks_profile_url
 *   - qs: seeds from qs_entity_profiles where entity_type IN ('university','school')
 *         excludes 'programme' entities
 *         uses canonical_university_id when available
 *
 * Run lock: prevents source change while a sequential run is active.
 */
Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin);
  const tid = req.headers.get("x-client-trace-id") || generateTraceId();

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return json({ ok: false, error: auth.error, trace_id: tid }, auth.status, cors);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const srv = createClient(SUPABASE_URL, SRV_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const pilotLimit = body?.pilot_limit ?? 0; // 0 = all
    const source: "uniranks" | "qs" = body?.source === "qs" ? "qs" : "uniranks";
    const pilotUniversityIds: string[] = body?.pilot_university_ids ?? [];

    // ── Run Lock: prevent source change while ANY sequential run is active ──
    // Source is locked for the ENTIRE run, not just when a batch has items.
    const { data: seqConfigRow } = await srv
      .from("crawl_settings").select("value").eq("key", "door2_sequential_config").single();
    const seqConfig = (seqConfigRow?.value as any) ?? {};

    if (seqConfig.mode === "sequential") {
      const activeSource = seqConfig.source || "uniranks";
      if (activeSource !== source) {
        return json({
          ok: false,
          error: `run_lock: Cannot change source to '${source}' while a '${activeSource}' sequential run is active. Stop the current run first.`,
          trace_id: tid,
        }, 409, cors);
      }
    }

    // Check if already enabled
    const { data: flagRow } = await srv
      .from("crawl_settings")
      .select("value")
      .eq("key", "door2_enabled")
      .single();

    const alreadyEnabled = flagRow?.value?.enabled === true;

    // Enable Door2
    await srv.from("crawl_settings").upsert({
      key: "door2_enabled",
      value: { enabled: true },
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" });

    // Unpause
    await srv.from("crawl_settings").upsert({
      key: "door2_config",
      value: {
        pause: false,
        max_units_per_tick: 5,
        retry_budget_default: 3,
        lock_seconds: 120,
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" });

    // Store source in sequential config (preserve existing fields)
    await srv.from("crawl_settings").upsert({
      key: "door2_sequential_config",
      value: { ...seqConfig, source },
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" });

    let unis: any[] = [];

    if (source === "qs") {
      // ── QS Seed: from qs_entity_profiles ──
      // Door2 v1: ONLY entity_type='university'. Schools deferred until entity_key is introduced.
      let query = srv
        .from("qs_entity_profiles")
        .select("university_id, qs_slug, entity_type, canonical_university_id")
        .eq("entity_type", "university")
        .not("university_id", "is", null);

      // Filter by specific university IDs if provided (pilot mode)
      if (pilotUniversityIds.length > 0) {
        query = query.in("university_id", pilotUniversityIds);
      } else if (pilotLimit > 0) {
        query = query.limit(pilotLimit);
      }

      const { data: qsEntities, error: qsErr } = await query;
      if (qsErr) {
        return json({ ok: false, error: qsErr.message, trace_id: tid }, 500, cors);
      }

      unis = (qsEntities || []).map((e: any) => ({
        id: e.university_id,
        source_profile_url: `https://www.topuniversities.com/universities/${e.qs_slug}`,
        entity_type: "university", // v1: university only
        canonical_university_id: e.canonical_university_id || null,
      }));
    } else {
      // ── UniRanks Seed: from universities.uniranks_profile_url ──
      let query = srv
        .from("universities")
        .select("id, uniranks_profile_url")
        .not("uniranks_profile_url", "is", null);

      if (pilotLimit > 0) {
        query = query.limit(pilotLimit);
      }

      const { data: uniData, error: uniErr } = await query;
      if (uniErr) {
        return json({ ok: false, error: uniErr.message, trace_id: tid }, 500, cors);
      }
      unis = (uniData || []).map((u: any) => ({
        id: u.id,
        source_profile_url: u.uniranks_profile_url,
        entity_type: "university",
        canonical_university_id: null,
      }));
    }

    let seeded = 0;
    let skipped = 0;

    // Batch insert with ON CONFLICT skip
    // Uses source-agnostic columns only
    const batchSize = 500;
    for (let i = 0; i < unis.length; i += batchSize) {
      const batch = unis.slice(i, i + batchSize).map(u => ({
        university_id: u.id,
        // Legacy column (kept for UniRanks compat)
        uniranks_profile_url: source === "uniranks" ? u.source_profile_url : null,
        // Source-agnostic columns
        source,
        source_profile_url: u.source_profile_url,
        entity_type: u.entity_type,
        canonical_university_id: u.canonical_university_id,
        // Legacy QS column
        qs_slug: source === "qs" ? u.source_profile_url.replace("https://www.topuniversities.com/universities/", "") : null,
        stage: "profile_pending",
        retry_count: 0,
        retry_budget: 3,
      }));

      const { data: inserted, error: insErr } = await srv
        .from("uniranks_crawl_state")
        .upsert(batch, { onConflict: "university_id", ignoreDuplicates: false })
        .select("university_id");

      if (!insErr) {
        seeded += inserted?.length ?? 0;
      }
    }

    skipped = unis.length - seeded;

    // Telemetry
    await srv.from("pipeline_health_events").insert({
      pipeline: "door2_harvester",
      event_type: "state",
      metric: "door2_started",
      value: seeded,
      details_json: {
        trace_id: tid,
        seeded,
        skipped,
        pilot_limit: pilotLimit,
        total_candidates: unis.length,
        already_enabled: alreadyEnabled,
        source,
        seed_rule: source === "qs" ? "entity_type = 'university' (v1: schools deferred)" : "uniranks_profile_url IS NOT NULL",
      },
    });

    slog({ tid, level: "info", action: "door2_started", seeded, skipped, pilot_limit: pilotLimit, source });

    return json({
      ok: true,
      trace_id: tid,
      seeded,
      skipped,
      total_candidates: unis.length,
      pilot_limit: pilotLimit,
      source,
      seed_rule: source === "qs" ? "entity_type = 'university' (v1: schools deferred)" : "uniranks_profile_url NOT NULL",
    }, 200, cors);
  } catch (err: any) {
    slog({ tid, level: "error", action: "door2_start_error", error: String(err) });
    return json({ ok: false, error: err?.message, trace_id: tid }, 500, cors);
  }
});

function json(data: any, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
