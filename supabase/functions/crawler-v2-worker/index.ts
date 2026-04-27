import { createClient } from "npm:@supabase/supabase-js@2";
import {
  handleCorsPreflight,
  getCorsHeaders,
  generateTraceId,
  slog,
} from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/adminGuard.ts";

// ── Constants ──────────────────────────────────────────────────────────────

const WORKER_VERSION       = "1b.0";
const LOCK_DURATION_MIN    = 10;
const FETCH_TIMEOUT_MS     = 15_000;
const MAX_BODY_CHARS       = 2_000_000; // ~2 MB stored in raw_pages.text_content
const USER_AGENT           = "OrxyaCrawlerBot/2.0 (+https://cswworld.com/bot)";

// Cloudflare challenge indicators (headers / body)
const CF_HEADER_INDICATORS = ["cf-ray", "cf-mitigated"];
const CF_BODY_INDICATORS   = [
  "Just a moment",
  "cf-browser-verification",
  "Checking your browser",
  "DDoS protection by Cloudflare",
];

// Active (non-terminal) item statuses — used when deciding run completion
const ACTIVE_STATUSES = [
  "queued", "website_check", "fetching",
  "rendering_needed", "rendering",
  "artifact_discovery", "artifact_parsing",
  "extracting", "ai_extracting",
];

// ── JSON response helper ───────────────────────────────────────────────────

function jsonResp(
  data: unknown,
  status = 200,
  origin: string | null = null,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...getCorsHeaders(origin) },
  });
}

// ── SHA-256 helper ─────────────────────────────────────────────────────────

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── URL validation ─────────────────────────────────────────────────────────

function isValidHttpUrl(raw: string): boolean {
  if (!raw || typeof raw !== "string") return false;
  try {
    const u = new URL(raw.trim());
    return (u.protocol === "http:" || u.protocol === "https:") &&
      u.hostname.length > 3;
  } catch {
    return false;
  }
}

// ── Telemetry helper ───────────────────────────────────────────────────────

type EventType = "started" | "completed" | "failed" | "warning" | "metric";

async function tlog(
  srv: ReturnType<typeof createClient>,
  p: {
    run_id: string;
    run_item_id: string;
    stage: string;
    event_type: EventType;
    duration_ms?: number;
    success?: boolean;
    error_type?: string;
    error_message?: string;
    metadata?: Record<string, unknown>;
    trace_id: string;
  },
): Promise<void> {
  const { error } = await srv.from("crawler_telemetry").insert({
    run_id:        p.run_id,
    run_item_id:   p.run_item_id,
    stage:         p.stage,
    event_type:    p.event_type,
    duration_ms:   p.duration_ms   ?? null,
    success:       p.success       ?? null,
    error_type:    p.error_type    ?? null,
    error_message: p.error_message ?? null,
    metadata:      p.metadata      ?? {},
    trace_id:      p.trace_id,
  });
  if (error) {
    slog({ level: "warn", msg: "telemetry_insert_failed", error: error.message, stage: p.stage });
  }
}

// ── Fetch result types ─────────────────────────────────────────────────────

type FetchOk = {
  ok: true;
  status_code: number;
  content_type: string;
  final_url: string;
  body_text: string;
  body_sha256: string;
};

type FetchFail = {
  ok: false;
  failure_reason: string;
  error_message: string;
};

// ── Homepage fetch ─────────────────────────────────────────────────────────

async function fetchHomepage(url: string): Promise<FetchOk | FetchFail> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":      USER_AGENT,
        "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    clearTimeout(timer);

    const statusCode = res.status;
    const contentType = res.headers.get("content-type") ?? "";
    const finalUrl = res.url || url;

    if (statusCode === 403) {
      return { ok: false, failure_reason: "http_403", error_message: `HTTP 403 from ${finalUrl}` };
    }
    if (statusCode === 404) {
      return { ok: false, failure_reason: "http_404", error_message: `HTTP 404 from ${finalUrl}` };
    }
    if (statusCode >= 500) {
      return { ok: false, failure_reason: "http_500", error_message: `HTTP ${statusCode} from ${finalUrl}` };
    }
    if (statusCode < 200 || statusCode >= 400) {
      return { ok: false, failure_reason: "http_500", error_message: `HTTP ${statusCode} from ${finalUrl}` };
    }

    // Detect Cloudflare via response headers
    const respHeaderKeys = Array.from(res.headers.keys());
    const cfViaHeaders = CF_HEADER_INDICATORS.some((h) => respHeaderKeys.includes(h));

    const rawBody = await res.text();

    if (!rawBody || rawBody.trim().length === 0) {
      return { ok: false, failure_reason: "empty_content", error_message: "Response body is empty" };
    }

    // Detect Cloudflare challenge via body text
    if (cfViaHeaders || CF_BODY_INDICATORS.some((ind) => rawBody.includes(ind))) {
      return { ok: false, failure_reason: "cloudflare_block", error_message: "Cloudflare challenge detected" };
    }

    const bodyText = rawBody.length > MAX_BODY_CHARS
      ? rawBody.slice(0, MAX_BODY_CHARS)
      : rawBody;

    const bodyHash = await sha256hex(bodyText);

    return {
      ok: true,
      status_code: statusCode,
      content_type: contentType,
      final_url: finalUrl,
      body_text: bodyText,
      body_sha256: bodyHash,
    };
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      return {
        ok: false,
        failure_reason: "timeout",
        error_message: `Fetch timed out after ${FETCH_TIMEOUT_MS}ms`,
      };
    }
    return {
      ok: false,
      failure_reason: "http_500",
      error_message: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Claimed item shape ─────────────────────────────────────────────────────

type ClaimedItem = {
  run_item_id:  string;
  run_id:       string;
  university_id: string;
  website:      string;
  target_domain: string;
  trace_id:     string;
};

// ── Update run status after item terminal transition ───────────────────────

async function syncRunStatus(
  srv: ReturnType<typeof createClient>,
  runId: string,
): Promise<void> {
  const { count: activeCount } = await srv
    .from("crawler_run_items")
    .select("id", { count: "exact", head: true })
    .eq("run_id", runId)
    .in("status", ACTIVE_STATUSES);

  if ((activeCount ?? 1) > 0) return; // still items in progress

  const { count: failedCount } = await srv
    .from("crawler_run_items")
    .select("id", { count: "exact", head: true })
    .eq("run_id", runId)
    .eq("status", "failed");

  const { count: totalCount } = await srv
    .from("crawler_run_items")
    .select("id", { count: "exact", head: true })
    .eq("run_id", runId);

  const newStatus =
    (failedCount ?? 0) > 0 && (failedCount ?? 0) === (totalCount ?? 0)
      ? "failed"
      : "completed";

  await srv
    .from("crawler_runs")
    .update({ status: newStatus, completed_at: new Date().toISOString() })
    .eq("id", runId);
}

// ── Release lock helper ────────────────────────────────────────────────────

async function releaseLock(
  srv: ReturnType<typeof createClient>,
  universityId: string,
  workerId: string,
): Promise<void> {
  await srv
    .from("crawler_locks")
    .delete()
    .eq("resource_type", "university")
    .eq("resource_id", universityId)
    .eq("lock_holder", workerId);
}

// ── Fail item ──────────────────────────────────────────────────────────────

async function failItem(
  srv: ReturnType<typeof createClient>,
  item: ClaimedItem,
  workerId: string,
  failureReason: string,
  failureDetail: string,
  tid: string,
  origin: string | null,
  workerStartMs: number,
): Promise<Response> {
  const durationMs = Date.now() - workerStartMs;

  await srv.from("crawler_run_items").update({
    status:         "failed",
    failure_reason: failureReason,
    failure_detail: failureDetail,
    completed_at:   new Date().toISOString(),
  }).eq("id", item.run_item_id);

  await releaseLock(srv, item.university_id, workerId);

  await tlog(srv, {
    run_id:        item.run_id,
    run_item_id:   item.run_item_id,
    stage:         "item",
    event_type:    "failed",
    duration_ms:   durationMs,
    success:       false,
    error_type:    failureReason,
    error_message: failureDetail,
    metadata:      { worker_id: workerId, worker_version: WORKER_VERSION },
    trace_id:      item.trace_id,
  });

  await syncRunStatus(srv, item.run_id);

  slog({ tid, level: "info", msg: "item_failed", run_item_id: item.run_item_id, reason: failureReason });

  return jsonResp({
    ok:             false,
    run_item_id:    item.run_item_id,
    run_id:         item.run_id,
    failure_reason: failureReason,
    failure_detail: failureDetail,
    duration_ms:    durationMs,
    trace_id:       tid,
  }, 200, origin);
}

// ── Action: run_item ───────────────────────────────────────────────────────

async function handleRunItem(
  srv: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  tid: string,
  origin: string | null,
): Promise<Response> {
  const workerId   = `worker-v0-${tid}`;
  const runItemId  = body.run_item_id as string | undefined;
  const workerStart = Date.now();

  slog({ tid, level: "info", msg: "worker_started", worker_id: workerId, target: runItemId ?? "FIFO" });

  // ── Step 1: Atomic claim ─────────────────────────────────────────────────
  const { data: claimRows, error: claimErr } = await srv.rpc(
    "rpc_claim_crawler_run_item",
    {
      p_worker_id:       workerId,
      p_run_item_id:     runItemId ?? null,
      p_lock_duration_min: LOCK_DURATION_MIN,
    },
  );

  if (claimErr) {
    slog({ tid, level: "error", msg: "claim_rpc_error", error: claimErr.message });
    return jsonResp({ ok: false, error: claimErr.message, trace_id: tid }, 500, origin);
  }

  const claimed = (claimRows as Array<Record<string, unknown>> | null)?.[0];

  if (!claimed || claimed.out_error) {
    const errCode = (claimed?.out_error as string) ?? "no_queued_item";
    slog({ tid, level: "info", msg: "claim_failed", reason: errCode });
    return jsonResp({ ok: false, error: errCode, trace_id: tid }, 200, origin);
  }

  const item: ClaimedItem = {
    run_item_id:   claimed.out_run_item_id  as string,
    run_id:        claimed.out_run_id        as string,
    university_id: claimed.out_university_id as string,
    website:       claimed.out_website       as string,
    target_domain: claimed.out_target_domain as string,
    trace_id:      claimed.out_trace_id      as string,
  };

  slog({ tid, level: "info", msg: "item_claimed", run_item_id: item.run_item_id });

  // ── Telemetry: worker_started ────────────────────────────────────────────
  await tlog(srv, {
    run_id:      item.run_id,
    run_item_id: item.run_item_id,
    stage:       "worker_v0",
    event_type:  "started",
    metadata:    { worker_id: workerId, worker_version: WORKER_VERSION },
    trace_id:    item.trace_id,
  });

  // ── Telemetry: item_claimed ──────────────────────────────────────────────
  await tlog(srv, {
    run_id:      item.run_id,
    run_item_id: item.run_item_id,
    stage:       "claim",
    event_type:  "started",
    success:     true,
    metadata:    { worker_id: workerId, run_item_id: item.run_item_id },
    trace_id:    item.trace_id,
  });

  // ── Telemetry: lock_acquired ─────────────────────────────────────────────
  await tlog(srv, {
    run_id:      item.run_id,
    run_item_id: item.run_item_id,
    stage:       "lock",
    event_type:  "started",
    success:     true,
    metadata: {
      resource_type: "university",
      resource_id:   item.university_id,
      lock_holder:   workerId,
      expires_min:   LOCK_DURATION_MIN,
    },
    trace_id: item.trace_id,
  });

  // ── Step 2: Re-validate URL ──────────────────────────────────────────────
  if (!item.website || !isValidHttpUrl(item.website)) {
    return await failItem(
      srv, item, workerId,
      "invalid_website", `URL failed re-validation: ${item.website}`,
      tid, origin, workerStart,
    );
  }

  // ── Step 3: Transition to fetching ──────────────────────────────────────
  await srv.from("crawler_run_items").update({
    status:           "fetching",
    stage:            "homepage_fetch",
    progress_percent: 20,
  }).eq("id", item.run_item_id);

  const fetchStart = Date.now();

  // ── Telemetry: homepage_fetch_started ────────────────────────────────────
  await tlog(srv, {
    run_id:      item.run_id,
    run_item_id: item.run_item_id,
    stage:       "homepage_fetch",
    event_type:  "started",
    metadata:    { url: item.website },
    trace_id:    item.trace_id,
  });

  // ── Step 4: Fetch homepage ───────────────────────────────────────────────
  const fetchResult = await fetchHomepage(item.website);
  const fetchDurationMs = Date.now() - fetchStart;

  if (!fetchResult.ok) {
    // ── Telemetry: homepage_fetch_failed ──────────────────────────────────
    await tlog(srv, {
      run_id:        item.run_id,
      run_item_id:   item.run_item_id,
      stage:         "homepage_fetch",
      event_type:    "failed",
      duration_ms:   fetchDurationMs,
      success:       false,
      error_type:    fetchResult.failure_reason,
      error_message: fetchResult.error_message,
      metadata:      { url: item.website },
      trace_id:      item.trace_id,
    });
    return await failItem(
      srv, item, workerId,
      fetchResult.failure_reason, fetchResult.error_message,
      tid, origin, workerStart,
    );
  }

  // ── Telemetry: homepage_fetch_completed ──────────────────────────────────
  await tlog(srv, {
    run_id:      item.run_id,
    run_item_id: item.run_item_id,
    stage:       "homepage_fetch",
    event_type:  "completed",
    duration_ms: fetchDurationMs,
    success:     true,
    metadata: {
      url:             item.website,
      final_url:       fetchResult.final_url,
      status_code:     fetchResult.status_code,
      content_type:    fetchResult.content_type,
      body_size_bytes: fetchResult.body_text.length,
      body_sha256:     fetchResult.body_sha256,
    },
    trace_id: item.trace_id,
  });

  // ── Step 5: Upsert into raw_pages ────────────────────────────────────────
  const { data: rpRow, error: rpErr } = await srv
    .from("raw_pages")
    .upsert(
      {
        url:           fetchResult.final_url || item.website,
        university_id: item.university_id,
        status_code:   fetchResult.status_code,
        content_type:  fetchResult.content_type,
        fetched_at:    new Date().toISOString(),
        body_sha256:   fetchResult.body_sha256,
        text_content:  fetchResult.body_text,
        fetch_attempts: 1,
        fetch_error:   null,
        needs_render:  false,
      },
      { onConflict: "url", ignoreDuplicates: false },
    )
    .select("id")
    .single();

  if (rpErr) {
    // Non-fatal — log and continue; we still mark the item as fetched
    slog({
      tid,
      level: "warn",
      msg:   "raw_pages_upsert_failed",
      error: rpErr.message,
      url:   fetchResult.final_url,
    });
  }

  const rawPageId: number | null = (rpRow as { id: number } | null)?.id ?? null;

  // ── Step 6: Advance item to artifact_discovery ───────────────────────────
  // artifact_discovery is the correct terminal state for 1B: homepage is
  // fetched and the item is ready for the Order 1C page planner.
  await srv.from("crawler_run_items").update({
    status:           "artifact_discovery",
    stage:            "homepage_fetched",
    progress_percent: 50,
    pages_found:      1,
    pages_fetched:    1,
  }).eq("id", item.run_item_id);

  // ── Step 7: Release lock ─────────────────────────────────────────────────
  await releaseLock(srv, item.university_id, workerId);

  // ── Telemetry: item_completed ────────────────────────────────────────────
  const totalDurationMs = Date.now() - workerStart;
  await tlog(srv, {
    run_id:      item.run_id,
    run_item_id: item.run_item_id,
    stage:       "item",
    event_type:  "completed",
    duration_ms: totalDurationMs,
    success:     true,
    metadata: {
      raw_page_id:     rawPageId,
      final_url:       fetchResult.final_url,
      status_code:     fetchResult.status_code,
      pages_fetched:   1,
      worker_version:  WORKER_VERSION,
    },
    trace_id: item.trace_id,
  });

  // Sync run-level status (run stays 'running' since item is in artifact_discovery,
  // which is an active status — correct behaviour for 1B)
  await syncRunStatus(srv, item.run_id);

  slog({ tid, level: "info", msg: "item_completed", run_item_id: item.run_item_id, duration_ms: totalDurationMs });

  return jsonResp({
    ok:              true,
    run_item_id:     item.run_item_id,
    run_id:          item.run_id,
    university_id:   item.university_id,
    website:         item.website,
    final_url:       fetchResult.final_url,
    raw_page_id:     rawPageId,
    status_code:     fetchResult.status_code,
    content_type:    fetchResult.content_type,
    body_size_bytes: fetchResult.body_text.length,
    body_sha256:     fetchResult.body_sha256,
    fetch_duration_ms: fetchDurationMs,
    total_duration_ms: totalDurationMs,
    final_status:    "artifact_discovery",
    trace_id:        tid,
  }, 200, origin);
}

// ── Main handler ───────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get("origin");
  const tid    = req.headers.get("x-client-trace-id") || generateTraceId();

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
      case "run_item":
        return await handleRunItem(srv, body, tid, origin);
      default:
        return jsonResp({ ok: false, error: "unknown_action", trace_id: tid }, 400, origin);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog({ tid, level: "error", error: msg });
    return jsonResp({ ok: false, error: msg, trace_id: tid }, 500, origin);
  }
});
