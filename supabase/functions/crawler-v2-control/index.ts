import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  handleCorsPreflight,
  getCorsHeaders,
  generateTraceId,
  slog,
} from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/adminGuard.ts";

// ── Constants ──────────────────────────────────────────────────────────────

const VALID_SCOPES = ["all", "country", "university", "custom_list"] as const;
const VALID_MODES = [
  "missing_or_stale", "failed_only", "full_refresh",
  "evidence_only", "orx_only", "media_only", "programs_only", "housing_only",
] as const;

type Scope = typeof VALID_SCOPES[number];
type Mode = typeof VALID_MODES[number];

// ── URL validation ─────────────────────────────────────────────────────────

function isValidHttpUrl(raw: string): boolean {
  if (!raw || typeof raw !== "string") return false;
  try {
    const u = new URL(raw.trim());
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.length > 3;
  } catch {
    return false;
  }
}

function extractDomain(raw: string): string {
  try {
    return new URL(raw.trim()).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// ── JSON response helper ───────────────────────────────────────────────────

function jsonResp(data: unknown, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...getCorsHeaders(origin),
    },
  });
}

// ── Main handler ───────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get("origin");
  const tid = req.headers.get("x-client-trace-id") || generateTraceId();

  // Admin guard
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return jsonResp({ ok: false, error: auth.error, trace_id: tid }, auth.status, origin);
  }

  const srv = auth.srv;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResp({ ok: false, error: "invalid_json", trace_id: tid }, 400, origin);
  }

  const action = body.action as string;
  slog({ tid, level: "info", action });

  try {
    switch (action) {
      case "create_run":
        return await handleCreateRun(srv, body, tid, origin);
      case "list_runs":
        return await handleListRuns(srv, tid, origin);
      case "get_run":
        return await handleGetRun(srv, body, tid, origin);
      // ── 1E: read views ────────────────────────────────────────────────────
      case "get_run_candidates":
        return await handleGetRunCandidates(srv, body, tid, origin);
      case "get_run_evidence":
        return await handleGetRunEvidence(srv, body, tid, origin);
      // ── 2: queue management ───────────────────────────────────────────────
      case "cancel_run":
        return await handleCancelRun(srv, body, tid, origin);
      case "pause_run":
        return await handlePauseRun(srv, body, tid, origin);
      case "resume_run":
        return await handleResumeRun(srv, body, tid, origin);
      case "retry_failed_item":
        return await handleRetryFailedItem(srv, body, tid, origin);
      case "cleanup_locks":
        return await handleCleanupLocks(srv, tid, origin);
      case "mark_stuck_items_failed":
        return await handleMarkStuckItemsFailed(srv, body, tid, origin);
      // ── 6: publish ────────────────────────────────────────────────────────
      case "verify_item":
        return await handleVerifyItem(srv, body, tid, origin);
      case "publish_item":
        return await handlePublishItem(srv, body, tid, origin);
      case "get_pending_review":
        return await handleGetPendingReview(srv, body, tid, origin);
      case "search_universities":
        return await handleSearchUniversities(srv, body, tid, origin);
      default:
        return jsonResp({ ok: false, error: "unknown_action", trace_id: tid }, 400, origin);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog({ tid, level: "error", error: msg });
    return jsonResp({ ok: false, error: msg, trace_id: tid }, 500, origin);
  }
});

// ── Action: create_run ─────────────────────────────────────────────────────

async function handleCreateRun(
  srv: SupabaseClient<any, any, any>,
  body: Record<string, unknown>,
  tid: string,
  origin: string | null,
): Promise<Response> {
  // Validate inputs
  const scope = (body.scope ?? "all") as Scope;
  const mode = (body.mode ?? "missing_or_stale") as Mode;

  if (!VALID_SCOPES.includes(scope)) {
    return jsonResp({ ok: false, error: `invalid_scope: ${scope}`, trace_id: tid }, 400, origin);
  }
  if (!VALID_MODES.includes(mode)) {
    return jsonResp({ ok: false, error: `invalid_mode: ${mode}`, trace_id: tid }, 400, origin);
  }

  const countryCode = body.country_code as string | undefined;
  const universityId = body.university_id as string | undefined;
  const universityIds = body.university_ids as string[] | undefined;
  const settings = (body.settings as Record<string, unknown>) ?? {};
  const runTraceId = (body.trace_id as string) || `crv2-${generateTraceId()}`;

  // scope-specific validation
  if (scope === "country" && !countryCode) {
    return jsonResp({ ok: false, error: "country_code required for scope=country", trace_id: tid }, 400, origin);
  }
  if (scope === "university" && !universityId) {
    return jsonResp({ ok: false, error: "university_id required for scope=university", trace_id: tid }, 400, origin);
  }
  if (scope === "custom_list" && (!universityIds || universityIds.length === 0)) {
    return jsonResp({ ok: false, error: "university_ids required for scope=custom_list", trace_id: tid }, 400, origin);
  }

  // Create the run record
  const { data: run, error: runErr } = await srv
    .from("crawler_runs")
    .insert({
      scope,
      mode,
      status: "queued",
      trace_id: runTraceId,
      settings_json: settings,
      filters_json: {
        country_code: countryCode ?? null,
        university_id: universityId ?? null,
        university_ids: universityIds ?? null,
      },
    })
    .select("id, trace_id")
    .single();

  if (runErr || !run) {
    slog({ tid, level: "error", error: runErr?.message });
    return jsonResp({ ok: false, error: runErr?.message ?? "run_insert_failed", trace_id: tid }, 500, origin);
  }

  const runId = run.id as string;

  // Build the university query
  let query = srv
    .from("universities")
    .select("id, name_en, name_ar, website, country_code")
    .eq("is_active", true);

  if (scope === "country" && countryCode) {
    query = query.eq("country_code", countryCode);
  } else if (scope === "university" && universityId) {
    query = query.eq("id", universityId);
  } else if (scope === "custom_list" && universityIds) {
    query = query.in("id", universityIds);
  }

  const { data: unis, error: uniErr } = await query;
  if (uniErr) {
    slog({ tid, level: "error", error: uniErr.message });
    // Mark run failed
    await srv.from("crawler_runs").update({ status: "failed" }).eq("id", runId);
    return jsonResp({ ok: false, error: uniErr.message, trace_id: tid }, 500, origin);
  }

  const universities = unis ?? [];
  const totalTargets = universities.length;

  // Update run total_targets
  await srv.from("crawler_runs").update({ total_targets: totalTargets }).eq("id", runId);

  if (totalTargets === 0) {
    await srv.from("crawler_runs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", runId);
    return jsonResp({
      ok: true,
      run_id: runId,
      trace_id: runTraceId,
      total_targets: 0,
      queued: 0,
      failed: 0,
      failure_breakdown: {},
    }, 200, origin);
  }

  // Process universities in batches to avoid payload limits
  const BATCH_SIZE = 100;
  let queuedCount = 0;
  const failureBreakdown: Record<string, number> = {};

  for (let i = 0; i < universities.length; i += BATCH_SIZE) {
    const batch = universities.slice(i, i + BATCH_SIZE);

    const targetUpserts: Array<{
      university_id: string;
      target_url: string;
      target_domain: string;
      target_type: string;
      source: string;
      status: string;
    }> = [];

    const runItems: Array<Record<string, unknown>> = [];

    for (const uni of batch) {
      const uniId = uni.id as string;
      const website = uni.website as string | null;
      const itemTrace = `${runTraceId}-${uniId.slice(0, 8)}`;

      if (!website) {
        // Missing website — record failed item
        runItems.push({
          run_id: runId,
          university_id: uniId,
          website: null,
          status: "failed",
          failure_reason: "missing_website",
          trace_id: itemTrace,
        });
        failureBreakdown["missing_website"] = (failureBreakdown["missing_website"] ?? 0) + 1;
        continue;
      }

      if (!isValidHttpUrl(website)) {
        // Invalid website
        runItems.push({
          run_id: runId,
          university_id: uniId,
          website,
          status: "failed",
          failure_reason: "invalid_website",
          trace_id: itemTrace,
        });
        failureBreakdown["invalid_website"] = (failureBreakdown["invalid_website"] ?? 0) + 1;
        continue;
      }

      const domain = extractDomain(website);

      // Prepare target upsert
      targetUpserts.push({
        university_id: uniId,
        target_url: website,
        target_domain: domain,
        target_type: "primary_website",
        source: "universities_table",
        status: "active",
      });

      // Queue the run item
      runItems.push({
        run_id: runId,
        university_id: uniId,
        website,
        target_domain: domain,
        status: "queued",
        trace_id: itemTrace,
      });
      queuedCount++;
    }

    // Upsert targets (ignore conflicts — reuse existing)
    if (targetUpserts.length > 0) {
      const { error: tgtErr } = await srv
        .from("crawler_targets")
        .upsert(targetUpserts, {
          onConflict: "university_id,target_url",
          ignoreDuplicates: false,
        });

      if (tgtErr) {
        slog({ tid, level: "warn", msg: "target upsert partial error", error: tgtErr.message });
      }

      // Back-fill target_id on queued items
      const { data: targets } = await srv
        .from("crawler_targets")
        .select("id, university_id")
        .in("university_id", targetUpserts.map((t) => t.university_id))
        .eq("target_type", "primary_website")
        .eq("status", "active");

      const targetMap = new Map<string, string>(
        (targets ?? []).map((t: { id: string; university_id: string }) => [t.university_id, t.id])
      );

      for (const item of runItems) {
        if (item.status === "queued") {
          const tId = targetMap.get(item.university_id as string);
          if (tId) item.target_id = tId;
        }
      }
    }

    // Insert run items
    if (runItems.length > 0) {
      const { error: itemErr } = await srv.from("crawler_run_items").insert(runItems);
      if (itemErr) {
        slog({ tid, level: "error", error: itemErr.message });
        await srv.from("crawler_runs").update({ status: "failed" }).eq("id", runId);
        return jsonResp({ ok: false, error: itemErr.message, trace_id: tid }, 500, origin);
      }
    }
  }

  // Mark run as running (targets built, ready for fetch workers)
  await srv
    .from("crawler_runs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", runId);

  slog({ tid, level: "info", run_id: runId, total_targets: totalTargets, queued: queuedCount });

  return jsonResp({
    ok: true,
    run_id: runId,
    trace_id: runTraceId,
    total_targets: totalTargets,
    queued: queuedCount,
    failed: totalTargets - queuedCount,
    failure_breakdown: failureBreakdown,
  }, 200, origin);
}

// ── Action: list_runs ──────────────────────────────────────────────────────

async function handleListRuns(
  srv: SupabaseClient<any, any, any>,
  tid: string,
  origin: string | null,
): Promise<Response> {
  const { data: runs, error } = await srv
    .from("crawler_runs")
    .select("id, scope, mode, status, total_targets, trace_id, created_at, started_at, completed_at, filters_json")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return jsonResp({ ok: false, error: error.message, trace_id: tid }, 500, origin);
  }

  if (!runs || runs.length === 0) {
    return jsonResp({ ok: true, runs: [], trace_id: tid }, 200, origin);
  }

  // Fetch item status counts per run in one query
  const runIds = runs.map((r: { id: string }) => r.id);
  const { data: itemCounts } = await srv
    .from("crawler_run_items")
    .select("run_id, status, failure_reason")
    .in("run_id", runIds);

  // Build count map per run
  type CountMap = {
    queued: number; failed: number; completed: number; needs_review: number; published: number;
    failure_breakdown: Record<string, number>;
  };
  const countMap = new Map<string, CountMap>();
  for (const item of itemCounts ?? []) {
    const rid = item.run_id as string;
    if (!countMap.has(rid)) {
      countMap.set(rid, { queued: 0, failed: 0, completed: 0, needs_review: 0, published: 0, failure_breakdown: {} });
    }
    const c = countMap.get(rid)!;
    const s = item.status as string;
    if (s === "queued") c.queued++;
    else if (s === "failed") {
      c.failed++;
      const fr = item.failure_reason as string;
      if (fr) c.failure_breakdown[fr] = (c.failure_breakdown[fr] ?? 0) + 1;
    } else if (s === "needs_review") c.needs_review++;
    else if (s === "published") c.published++;
    else c.completed++;
  }

  const enriched = (runs as Array<Record<string, unknown>>).map((r) => {
    const counts = countMap.get(r.id as string) ?? { queued: 0, failed: 0, completed: 0, needs_review: 0, published: 0, failure_breakdown: {} };
    return { ...r, ...counts };
  });

  return jsonResp({ ok: true, runs: enriched, trace_id: tid }, 200, origin);
}

// ── Action: get_run ────────────────────────────────────────────────────────

async function handleGetRun(
  srv: SupabaseClient<any, any, any>,
  body: Record<string, unknown>,
  tid: string,
  origin: string | null,
): Promise<Response> {
  const runId = body.run_id as string | undefined;
  if (!runId) {
    return jsonResp({ ok: false, error: "run_id required", trace_id: tid }, 400, origin);
  }

  const { data: run, error: runErr } = await srv
    .from("crawler_runs")
    .select("*")
    .eq("id", runId)
    .single();

  if (runErr || !run) {
    return jsonResp({ ok: false, error: "run_not_found", trace_id: tid }, 404, origin);
  }

  // Item counts by status
  const { data: allItems } = await srv
    .from("crawler_run_items")
    .select("status, failure_reason, university_id, website, trace_id, updated_at")
    .eq("run_id", runId)
    .order("created_at", { ascending: true })
    .limit(100);

  const statusBreakdown: Record<string, number> = {};
  const failureBreakdown: Record<string, number> = {};
  for (const item of allItems ?? []) {
    const s = item.status as string;
    statusBreakdown[s] = (statusBreakdown[s] ?? 0) + 1;
    if (s === "failed" && item.failure_reason) {
      const fr = item.failure_reason as string;
      failureBreakdown[fr] = (failureBreakdown[fr] ?? 0) + 1;
    }
  }

  // Fetch university names for first 100 items
  const uniIds = (allItems ?? []).map((i: { university_id: string }) => i.university_id).filter(Boolean);
  let uniNameMap: Map<string, string> = new Map();
  if (uniIds.length > 0) {
    const { data: uniNames } = await srv
      .from("universities")
      .select("id, name_en, name_ar")
      .in("id", uniIds);
    uniNameMap = new Map(
      (uniNames ?? []).map((u: { id: string; name_en: string | null; name_ar: string | null }) => [
        u.id,
        u.name_en ?? u.name_ar ?? u.id,
      ])
    );
  }

  const items = (allItems ?? []).map((item: Record<string, unknown>) => ({
    ...item,
    university_name: uniNameMap.get(item.university_id as string) ?? null,
  }));

  return jsonResp({
    ok: true,
    run,
    status_breakdown: statusBreakdown,
    failure_breakdown: failureBreakdown,
    items,
    trace_id: tid,
  }, 200, origin);
}

// ── Action: get_run_candidates (1E) ────────────────────────────────────────

async function handleGetRunCandidates(
  srv: SupabaseClient<any, any, any>,
  body: Record<string, unknown>,
  tid: string,
  origin: string | null,
): Promise<Response> {
  const runId = body.run_id as string | undefined;
  if (!runId) return jsonResp({ ok: false, error: "run_id required", trace_id: tid }, 400, origin);

  const { data, error } = await srv
    .from("crawler_page_candidates")
    .select("id,crawler_run_item_id,candidate_url,candidate_type,discovery_method,priority,status,fetch_error,created_at")
    .eq("crawler_run_id", runId)
    .order("priority", { ascending: false })
    .limit(500);

  if (error) return jsonResp({ ok: false, error: error.message, trace_id: tid }, 500, origin);
  return jsonResp({ ok: true, candidates: data ?? [], total: (data ?? []).length, trace_id: tid }, 200, origin);
}

// ── Action: get_run_evidence (1E) ──────────────────────────────────────────

async function handleGetRunEvidence(
  srv: SupabaseClient<any, any, any>,
  body: Record<string, unknown>,
  tid: string,
  origin: string | null,
): Promise<Response> {
  const runId = body.run_id as string | undefined;
  if (!runId) return jsonResp({ ok: false, error: "run_id required", trace_id: tid }, 400, origin);

  const { data, error } = await srv
    .from("evidence_items")
    .select("id,crawler_run_item_id,university_id,entity_type,fact_group,field_key,value_raw,source_url,confidence_0_100,trust_level,validation_status,review_status,publish_status,orx_layer,orx_signal_family,created_at")
    .eq("crawler_run_id", runId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return jsonResp({ ok: false, error: error.message, trace_id: tid }, 500, origin);
  return jsonResp({ ok: true, evidence: data ?? [], total: (data ?? []).length, trace_id: tid }, 200, origin);
}

// ── Action: cancel_run (2) ─────────────────────────────────────────────────

async function handleCancelRun(
  srv: SupabaseClient<any, any, any>,
  body: Record<string, unknown>,
  tid: string,
  origin: string | null,
): Promise<Response> {
  const runId = body.run_id as string | undefined;
  if (!runId) return jsonResp({ ok: false, error: "run_id required", trace_id: tid }, 400, origin);

  const ACTIVE = ["queued","website_check","fetching","rendering_needed","rendering",
    "artifact_discovery","artifact_parsing","extracting","ai_extracting"];

  const { error: itemErr } = await srv
    .from("crawler_run_items")
    .update({ status: "failed", failure_reason: "publish_blocked", updated_at: new Date().toISOString() })
    .eq("run_id", runId)
    .in("status", ACTIVE);

  if (itemErr) return jsonResp({ ok: false, error: itemErr.message, trace_id: tid }, 500, origin);

  await srv.from("crawler_runs").update({
    status: "cancelled", completed_at: new Date().toISOString(),
  }).eq("id", runId);

  return jsonResp({ ok: true, run_id: runId, trace_id: tid }, 200, origin);
}

// ── Action: pause_run (2) ─────────────────────────────────────────────────

async function handlePauseRun(
  srv: SupabaseClient<any, any, any>,
  body: Record<string, unknown>,
  tid: string,
  origin: string | null,
): Promise<Response> {
  const runId = body.run_id as string | undefined;
  if (!runId) return jsonResp({ ok: false, error: "run_id required", trace_id: tid }, 400, origin);

  await srv.from("crawler_runs").update({ status: "paused" }).eq("id", runId).in("status", ["running", "queued"]);
  return jsonResp({ ok: true, run_id: runId, trace_id: tid }, 200, origin);
}

// ── Action: resume_run (2) ────────────────────────────────────────────────

async function handleResumeRun(
  srv: SupabaseClient<any, any, any>,
  body: Record<string, unknown>,
  tid: string,
  origin: string | null,
): Promise<Response> {
  const runId = body.run_id as string | undefined;
  if (!runId) return jsonResp({ ok: false, error: "run_id required", trace_id: tid }, 400, origin);

  await srv.from("crawler_runs").update({ status: "running" }).eq("id", runId).eq("status", "paused");
  return jsonResp({ ok: true, run_id: runId, trace_id: tid }, 200, origin);
}

// ── Action: retry_failed_item (2) ─────────────────────────────────────────

async function handleRetryFailedItem(
  srv: SupabaseClient<any, any, any>,
  body: Record<string, unknown>,
  tid: string,
  origin: string | null,
): Promise<Response> {
  const runItemId = body.run_item_id as string | undefined;
  if (!runItemId) return jsonResp({ ok: false, error: "run_item_id required", trace_id: tid }, 400, origin);

  const { error } = await srv
    .from("crawler_run_items")
    .update({
      status: "queued", stage: null, failure_reason: null, failure_detail: null,
      progress_percent: 0, updated_at: new Date().toISOString(),
    })
    .eq("id", runItemId)
    .eq("status", "failed");

  if (error) return jsonResp({ ok: false, error: error.message, trace_id: tid }, 500, origin);
  return jsonResp({ ok: true, run_item_id: runItemId, trace_id: tid }, 200, origin);
}

// ── Action: cleanup_locks (2) ─────────────────────────────────────────────

async function handleCleanupLocks(
  srv: SupabaseClient<any, any, any>,
  tid: string,
  origin: string | null,
): Promise<Response> {
  const { data, error } = await srv.rpc("cleanup_expired_crawler_locks");
  if (error) return jsonResp({ ok: false, error: error.message, trace_id: tid }, 500, origin);
  return jsonResp({ ok: true, deleted: data ?? 0, trace_id: tid }, 200, origin);
}

// ── Action: mark_stuck_items_failed (2) ───────────────────────────────────

async function handleMarkStuckItemsFailed(
  srv: SupabaseClient<any, any, any>,
  body: Record<string, unknown>,
  tid: string,
  origin: string | null,
): Promise<Response> {
  const stuckMinutes = (body.stuck_minutes as number | undefined) ?? 30;
  const cutoff = new Date(Date.now() - stuckMinutes * 60_000).toISOString();

  const STUCK_STATUSES = ["website_check","fetching","rendering","rendering_needed",
    "artifact_discovery","artifact_parsing","extracting","ai_extracting"];

  const { data: stuck } = await srv
    .from("crawler_run_items")
    .select("id")
    .in("status", STUCK_STATUSES)
    .lt("updated_at", cutoff);

  if (!stuck || stuck.length === 0) {
    return jsonResp({ ok: true, marked: 0, trace_id: tid }, 200, origin);
  }

  const ids = stuck.map((i: { id: string }) => i.id);
  await srv.from("crawler_run_items").update({
    status: "failed", failure_reason: "timeout",
    failure_detail: `Stuck > ${stuckMinutes}min`,
    updated_at: new Date().toISOString(),
  }).in("id", ids);

  return jsonResp({ ok: true, marked: ids.length, trace_id: tid }, 200, origin);
}

// ── Action: get_pending_review (6) ────────────────────────────────────────

async function handleGetPendingReview(
  srv: SupabaseClient<any, any, any>,
  body: Record<string, unknown>,
  tid: string,
  origin: string | null,
): Promise<Response> {
  const runId = body.run_id as string | undefined;

  let query = srv
    .from("crawler_run_items")
    .select("id,run_id,university_id,website,status,stage,progress_percent,evidence_count,orx_signal_count,trace_id,updated_at")
    .in("status", ["needs_review", "verified"])
    .order("updated_at", { ascending: false })
    .limit(100);

  if (runId) query = query.eq("run_id", runId);

  const { data, error } = await query;
  if (error) return jsonResp({ ok: false, error: error.message, trace_id: tid }, 500, origin);

  // Enrich with university name
  const uniIds = (data ?? []).map((i: { university_id: string }) => i.university_id).filter(Boolean);
  let uniMap: Map<string, string> = new Map();
  if (uniIds.length > 0) {
    const { data: unis } = await srv.from("universities").select("id,name_en,name_ar").in("id", uniIds);
    uniMap = new Map((unis ?? []).map((u: { id: string; name_en: string; name_ar: string }) => [
      u.id, u.name_en ?? u.name_ar ?? u.id,
    ]));
  }

  const items = (data ?? []).map((i: Record<string, unknown>) => ({
    ...i, university_name: uniMap.get(i.university_id as string) ?? null,
  }));

  return jsonResp({ ok: true, items, total: items.length, trace_id: tid }, 200, origin);
}

// ── Action: verify_item (6) ───────────────────────────────────────────────

async function handleVerifyItem(
  srv: SupabaseClient<any, any, any>,
  body: Record<string, unknown>,
  tid: string,
  origin: string | null,
): Promise<Response> {
  const runItemId = body.run_item_id as string | undefined;
  if (!runItemId) return jsonResp({ ok: false, error: "run_item_id required", trace_id: tid }, 400, origin);

  const { data, error } = await srv.rpc("rpc_v2_verify_run_item", {
    p_run_item_id: runItemId,
    p_reviewer_id: null,
  });

  if (error) return jsonResp({ ok: false, error: error.message, trace_id: tid }, 500, origin);
  return jsonResp({ ...(data as object), trace_id: tid }, 200, origin);
}

// ── Action: publish_item (6) ──────────────────────────────────────────────

async function handlePublishItem(
  srv: SupabaseClient<any, any, any>,
  body: Record<string, unknown>,
  tid: string,
  origin: string | null,
): Promise<Response> {
  const runItemId = body.run_item_id as string | undefined;
  if (!runItemId) return jsonResp({ ok: false, error: "run_item_id required", trace_id: tid }, 400, origin);

  const { data, error } = await srv.rpc("rpc_v2_publish_run_item", {
    p_run_item_id:  runItemId,
    p_publisher_id: null,
  });

  if (error) return jsonResp({ ok: false, error: error.message, trace_id: tid }, 500, origin);
  return jsonResp({ ...(data as object), trace_id: tid }, 200, origin);
}

// ── Action: search_universities ────────────────────────────────────────────

async function handleSearchUniversities(
  srv: SupabaseClient<any, any, any>,
  body: Record<string, unknown>,
  tid: string,
  origin: string | null,
): Promise<Response> {
  const rawQuery = (body.query as string | undefined)?.trim() ?? "";
  const limitRaw = body.limit as number | undefined;
  const limit = Math.min(Math.max(typeof limitRaw === "number" ? limitRaw : 20, 1), 50);

  if (rawQuery.length < 2) {
    return jsonResp({ ok: true, results: [], trace_id: tid }, 200, origin);
  }

  // Sanitize for ilike: escape % and _ and remove commas (PostgREST `or` separator)
  const safe = rawQuery.replace(/[,%_]/g, " ").replace(/\s+/g, " ").trim();
  const pattern = `%${safe}%`;

  const orClauses = [
    `name.ilike.${pattern}`,
    `name_en.ilike.${pattern}`,
    `name_ar.ilike.${pattern}`,
    `slug.ilike.${pattern}`,
    `website.ilike.${pattern}`,
  ].join(",");

  const { data, error } = await srv
    .from("universities")
    .select("id, name, name_en, name_ar, slug, website, country_code, city, is_active")
    .eq("is_active", true)
    .or(orClauses)
    .order("name_en", { ascending: true, nullsFirst: false })
    .limit(limit);

  if (error) {
    slog({ tid, level: "error", error: error.message });
    return jsonResp({ ok: false, error: error.message, trace_id: tid }, 500, origin);
  }

  type UniRow = {
    id: string;
    name: string | null;
    name_en: string | null;
    name_ar: string | null;
    slug: string | null;
    website: string | null;
    country_code: string | null;
    city: string | null;
  };

  const results = ((data ?? []) as UniRow[]).map((u) => ({
    id: u.id,
    name: u.name_en || u.name || u.name_ar || u.slug || u.id,
    name_en: u.name_en,
    name_ar: u.name_ar,
    slug: u.slug,
    country: u.country_code,
    city: u.city,
    website: u.website,
  }));

  return jsonResp({ ok: true, results, trace_id: tid }, 200, origin);
}
