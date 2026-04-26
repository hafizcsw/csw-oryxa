import { createClient } from "@supabase/supabase-js";
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
  srv: ReturnType<typeof createClient>,
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
  srv: ReturnType<typeof createClient>,
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
  srv: ReturnType<typeof createClient>,
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
