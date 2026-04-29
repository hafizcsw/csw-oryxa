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
type EventType = "started" | "completed" | "failed" | "warning" | "metric";

const ACTIVE_ITEM_STATUSES = [
  "queued", "website_check", "fetching", "rendering_needed", "rendering",
  "artifact_discovery", "artifact_parsing", "extracting", "ai_extracting",
] as const;

const STUCK_ITEM_STATUSES = [
  "website_check", "fetching", "rendering", "rendering_needed",
  "artifact_discovery", "artifact_parsing", "extracting", "ai_extracting",
] as const;

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

async function logControlTelemetry(
  srv: SupabaseClient<any, any, any>,
  p: {
    run_id?: string | null;
    run_item_id?: string | null;
    stage: string;
    event_type: EventType;
    success?: boolean;
    error_type?: string;
    error_message?: string;
    metadata?: Record<string, unknown>;
    trace_id: string;
  },
): Promise<void> {
  await srv.from("crawler_telemetry").insert({
    run_id: p.run_id ?? null,
    run_item_id: p.run_item_id ?? null,
    stage: p.stage,
    event_type: p.event_type,
    success: p.success ?? null,
    error_type: p.error_type ?? null,
    error_message: p.error_message ?? null,
    metadata: { control_action: true, ...p.metadata },
    trace_id: p.trace_id,
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
      case "run_selected_stage":
        return jsonResp({
          ok: false,
          error: "selected_stage_execution_not_supported",
          reason: "Crawler v2 control does not execute stages directly; invoke the scoped stage function with one run_item_id.",
          trace_id: tid,
        }, 400, origin);
      // ── 6: publish ────────────────────────────────────────────────────────
      case "verify_item":
        return await handleVerifyItem(srv, body, tid, origin);
      case "preview_publish_item":
        return await handlePreviewPublishItem(srv, body, tid, origin);
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
    .select("id, status, stage, progress_percent, failure_reason, university_id, website, trace_id, created_at, updated_at, evidence_count, pages_found, pages_fetched")
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
  const runItemId = body.run_item_id as string | undefined;
  if (!runId && !runItemId) return jsonResp({ ok: false, error: "run_id or run_item_id required", trace_id: tid }, 400, origin);

  let query = srv
    .from("crawler_page_candidates")
    .select("id,crawler_run_item_id,candidate_url,candidate_type,discovery_method,priority,status,fetch_error,trace_id,created_at")
    .order("priority", { ascending: false })
    .limit(500);

  if (runItemId) query = query.eq("crawler_run_item_id", runItemId);
  else query = query.eq("crawler_run_id", runId);

  const { data, error } = await query;

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
  const runItemId = body.run_item_id as string | undefined;
  if (!runId && !runItemId) return jsonResp({ ok: false, error: "run_id or run_item_id required", trace_id: tid }, 400, origin);

  let query = srv
    .from("evidence_items")
    .select("id,crawler_run_item_id,university_id,entity_type,fact_group,field_key,value_raw,evidence_quote,source_url,confidence_0_100,trust_level,validation_status,review_status,publish_status,extraction_method,model_provider,model_name,trace_id,orx_layer,orx_signal_family,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (runItemId) query = query.eq("crawler_run_item_id", runItemId);
  else query = query.eq("crawler_run_id", runId);

  const { data, error } = await query;

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

  const { data: items, error: itemErr } = await srv
    .from("crawler_run_items")
    .update({ status: "failed", failure_reason: "publish_blocked", updated_at: new Date().toISOString() })
    .eq("run_id", runId)
    .in("status", ACTIVE_ITEM_STATUSES)
    .select("id");

  if (itemErr) return jsonResp({ ok: false, error: itemErr.message, trace_id: tid }, 500, origin);

  const { data: run, error: runErr } = await srv.from("crawler_runs").update({
    status: "cancelled", completed_at: new Date().toISOString(),
  }).eq("id", runId).in("status", ["running", "queued", "paused"]).select("id").maybeSingle();

  if (runErr) return jsonResp({ ok: false, error: runErr.message, trace_id: tid }, 500, origin);
  if (!run) return jsonResp({ ok: false, error: "invalid_state_for_cancel", run_id: runId, trace_id: tid }, 409, origin);

  await logControlTelemetry(srv, {
    run_id: runId,
    stage: "queue_control",
    event_type: "completed",
    success: true,
    metadata: { action: "cancel_run", items_cancelled: items?.length ?? 0 },
    trace_id: tid,
  });

  return jsonResp({ ok: true, run_id: runId, items_cancelled: items?.length ?? 0, trace_id: tid }, 200, origin);
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

  const { data, error } = await srv
    .from("crawler_runs")
    .update({ status: "paused" })
    .eq("id", runId)
    .in("status", ["running", "queued"])
    .select("id")
    .maybeSingle();
  if (error) return jsonResp({ ok: false, error: error.message, trace_id: tid }, 500, origin);
  if (!data) return jsonResp({ ok: false, error: "invalid_state_for_pause", run_id: runId, trace_id: tid }, 409, origin);

  await logControlTelemetry(srv, {
    run_id: runId,
    stage: "queue_control",
    event_type: "completed",
    success: true,
    metadata: { action: "pause_run" },
    trace_id: tid,
  });
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

  const { data, error } = await srv
    .from("crawler_runs")
    .update({ status: "running" })
    .eq("id", runId)
    .eq("status", "paused")
    .select("id")
    .maybeSingle();
  if (error) return jsonResp({ ok: false, error: error.message, trace_id: tid }, 500, origin);
  if (!data) return jsonResp({ ok: false, error: "invalid_state_for_resume", run_id: runId, trace_id: tid }, 409, origin);

  await logControlTelemetry(srv, {
    run_id: runId,
    stage: "queue_control",
    event_type: "completed",
    success: true,
    metadata: { action: "resume_run" },
    trace_id: tid,
  });
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

  const { data, error } = await srv
    .from("crawler_run_items")
    .update({
      status: "queued", stage: null, failure_reason: null, failure_detail: null,
      progress_percent: 0, updated_at: new Date().toISOString(),
    })
    .eq("id", runItemId)
    .eq("status", "failed")
    .select("id,run_id");

  if (error) return jsonResp({ ok: false, error: error.message, trace_id: tid }, 500, origin);
  if (!data || data.length === 0) return jsonResp({ ok: false, error: "invalid_state_for_retry", run_item_id: runItemId, trace_id: tid }, 409, origin);

  await logControlTelemetry(srv, {
    run_id: data[0].run_id as string,
    run_item_id: runItemId,
    stage: "queue_control",
    event_type: "completed",
    success: true,
    metadata: { action: "retry_failed_item" },
    trace_id: tid,
  });
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

  await logControlTelemetry(srv, {
    stage: "queue_control",
    event_type: "completed",
    success: true,
    metadata: { action: "cleanup_locks", deleted: data ?? 0 },
    trace_id: tid,
  });

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
  const runId = body.run_id as string | undefined;
  const runItemId = body.run_item_id as string | undefined;

  if (!runId && !runItemId) {
    return jsonResp({
      ok: false,
      error: "run_id or run_item_id required",
      reason: "mark_stuck_items_failed is intentionally scoped and will not mutate all runs.",
      trace_id: tid,
    }, 400, origin);
  }

  const cutoff = new Date(Date.now() - stuckMinutes * 60_000).toISOString();

  let query = srv
    .from("crawler_run_items")
    .select("id,run_id")
    .in("status", STUCK_ITEM_STATUSES)
    .lt("updated_at", cutoff);

  if (runItemId) query = query.eq("id", runItemId);
  else query = query.eq("run_id", runId);

  const { data: stuck, error: stuckErr } = await query;
  if (stuckErr) return jsonResp({ ok: false, error: stuckErr.message, trace_id: tid }, 500, origin);

  if (!stuck || stuck.length === 0) {
    return jsonResp({ ok: true, marked: 0, run_id: runId ?? null, run_item_id: runItemId ?? null, trace_id: tid }, 200, origin);
  }

  const ids = stuck.map((i: { id: string }) => i.id);
  const { error: updateErr } = await srv.from("crawler_run_items").update({
    status: "failed", failure_reason: "timeout",
    failure_detail: `Stuck > ${stuckMinutes}min`,
    updated_at: new Date().toISOString(),
  }).in("id", ids);
  if (updateErr) return jsonResp({ ok: false, error: updateErr.message, trace_id: tid }, 500, origin);

  await logControlTelemetry(srv, {
    run_id: runId ?? (stuck[0].run_id as string),
    run_item_id: runItemId ?? null,
    stage: "queue_control",
    event_type: "completed",
    success: true,
    metadata: { action: "mark_stuck_items_failed", marked: ids.length, stuck_minutes: stuckMinutes },
    trace_id: tid,
  });

  return jsonResp({ ok: true, marked: ids.length, run_id: runId ?? null, run_item_id: runItemId ?? null, trace_id: tid }, 200, origin);
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

// ── Action: preview_publish_item (6) ──────────────────────────────────────

async function handlePreviewPublishItem(
  srv: SupabaseClient<any, any, any>,
  body: Record<string, unknown>,
  tid: string,
  origin: string | null,
): Promise<Response> {
  const runItemId = body.run_item_id as string | undefined;
  if (!runItemId) return jsonResp({ ok: false, error: "run_item_id required", dry_run: true, trace_id: tid }, 400, origin);

  const { data: item, error: itemErr } = await srv
    .from("crawler_run_items")
    .select("id,run_id,university_id,status,stage,progress_percent,trace_id,updated_at")
    .eq("id", runItemId)
    .maybeSingle();

  if (itemErr) return jsonResp({ ok: false, error: itemErr.message, dry_run: true, trace_id: tid }, 500, origin);
  if (!item) return jsonResp({ ok: false, error: "run_item_not_found", dry_run: true, trace_id: tid }, 404, origin);

  if (item.status !== "verified") {
    return jsonResp({
      ok: false,
      error: "invalid_status_for_publish_preview",
      current_status: item.status,
      required_status: "verified",
      dry_run: true,
      trace_id: tid,
    }, 409, origin);
  }

  const { count: unverifiedCount, error: unverifiedErr } = await srv
    .from("evidence_items")
    .select("id", { count: "exact", head: true })
    .eq("crawler_run_item_id", runItemId)
    .in("review_status", ["pending", "needs_revision"])
    .eq("publish_status", "unpublished");

  if (unverifiedErr) return jsonResp({ ok: false, error: unverifiedErr.message, dry_run: true, trace_id: tid }, 500, origin);
  if ((unverifiedCount ?? 0) > 0) {
    return jsonResp({
      ok: false,
      error: "unverified_evidence_exists",
      unverified_count: unverifiedCount ?? 0,
      dry_run: true,
      trace_id: tid,
    }, 409, origin);
  }

  const { data: evidence, error: evidenceErr } = await srv
    .from("evidence_items")
    .select("id,fact_group,field_key,confidence_0_100,source_url,trace_id,created_at,updated_at")
    .eq("crawler_run_item_id", runItemId)
    .eq("review_status", "verified")
    .eq("publish_status", "unpublished")
    .limit(500);

  if (evidenceErr) return jsonResp({ ok: false, error: evidenceErr.message, dry_run: true, trace_id: tid }, 500, origin);
  const rows = evidence ?? [];
  if (rows.length === 0) {
    return jsonResp({
      ok: false,
      error: "no_verified_unpublished_evidence",
      dry_run: true,
      trace_id: tid,
    }, 409, origin);
  }

  const confidences = rows
    .map((e: { confidence_0_100: number | null }) => e.confidence_0_100)
    .filter((v: number | null): v is number => typeof v === "number");
  const confidenceAvg = confidences.length > 0
    ? Math.round(confidences.reduce((sum, v) => sum + v, 0) / confidences.length)
    : null;
  const confidenceMin = confidences.length > 0 ? Math.min(...confidences) : null;
  const evidenceIds = rows.map((e: { id: string }) => e.id);

  return jsonResp({
    ok: true,
    dry_run: true,
    run_item_id: runItemId,
    run_id: item.run_id,
    trace_id: tid,
    item_trace_id: item.trace_id,
    evidence_item_ids: evidenceIds,
    affected_canonical_tables: [],
    affected_operational_tables: [
      { table: "evidence_items", fields: ["publish_status", "updated_at"] },
      { table: "crawler_run_items", fields: ["status", "stage", "progress_percent", "completed_at", "updated_at"] },
      { table: "publish_audit_trail", fields: ["action", "evidence_item_ids", "before_snapshot", "after_snapshot", "rollback_snapshot"] },
    ],
    before_snapshot_shape: {
      run_item_status: item.status,
      run_item_stage: item.stage,
      run_item_progress_percent: item.progress_percent,
      verified_unpublished_evidence_count: rows.length,
      confidence_avg: confidenceAvg,
      confidence_min: confidenceMin,
    },
    after_preview_shape: {
      run_item_status: "published",
      run_item_stage: "evidence_published",
      run_item_progress_percent: 100,
      evidence_publish_status: "published",
      evidence_published_count: rows.length,
    },
    rollback_plan: {
      action: "restore_operational_publish_state",
      evidence_item_ids: evidenceIds,
      evidence_publish_status: "unpublished",
      run_item_status: item.status,
      run_item_stage: item.stage,
      run_item_progress_percent: item.progress_percent,
    },
    real_publish_rpc_called: false,
  }, 200, origin);
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

  const { data: item, error: itemErr } = await srv
    .from("crawler_run_items")
    .select("id,status")
    .eq("id", runItemId)
    .maybeSingle();

  if (itemErr) return jsonResp({ ok: false, error: itemErr.message, trace_id: tid }, 500, origin);
  if (!item) return jsonResp({ ok: false, error: "run_item_not_found", trace_id: tid }, 404, origin);
  if (item.status !== "verified") {
    return jsonResp({
      ok: false,
      error: "invalid_status_for_publish",
      current_status: item.status,
      required_status: "verified",
      trace_id: tid,
    }, 409, origin);
  }

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
