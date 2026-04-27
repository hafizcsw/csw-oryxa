import type { SupabaseClient } from "@supabase/supabase-js";
import {
  handleCorsPreflight,
  getCorsHeaders,
  generateTraceId,
  slog,
} from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/adminGuard.ts";

// ── Constants ──────────────────────────────────────────────────────────────

const EXTRACTOR_VERSION = "1d.0";

type EventType = "started" | "completed" | "failed" | "warning" | "metric";

// ── JSON response helper ───────────────────────────────────────────────────

function jsonResp(data: unknown, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...getCorsHeaders(origin) },
  });
}

// ── SHA-256 helper ─────────────────────────────────────────────────────────

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Telemetry helper ───────────────────────────────────────────────────────

async function tlog(
  srv: SupabaseClient<any, any, any>,
  p: {
    run_id: string; run_item_id: string; stage: string; event_type: EventType;
    duration_ms?: number; success?: boolean; error_type?: string;
    error_message?: string; metadata?: Record<string, unknown>; trace_id: string;
  },
): Promise<void> {
  await srv.from("crawler_telemetry").insert({
    run_id: p.run_id, run_item_id: p.run_item_id, stage: p.stage,
    event_type: p.event_type, duration_ms: p.duration_ms ?? null,
    success: p.success ?? null, error_type: p.error_type ?? null,
    error_message: p.error_message ?? null,
    metadata: { extractor_version: EXTRACTOR_VERSION, ...p.metadata },
    trace_id: p.trace_id,
  });
}

// ── HTML extractors ────────────────────────────────────────────────────────

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>\s*([^<]{1,300})\s*<\/title>/i);
  return m ? m[1].trim() : null;
}

function extractMetaDescription(html: string): string | null {
  const m = html.match(/<meta\s[^>]*name=["']description["'][^>]*content=["']([^"']{1,500})["']/i)
         || html.match(/<meta\s[^>]*content=["']([^"']{1,500})["'][^>]*name=["']description["']/i);
  return m ? m[1].trim() : null;
}

function extractLangCode(html: string): string | null {
  const m = html.match(/<html[^>]*lang=["']([a-zA-Z-]{2,10})["']/i);
  return m ? m[1].toLowerCase() : null;
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

// ── Main: extract_homepage ─────────────────────────────────────────────────

async function extractHomepage(
  srv: SupabaseClient<any, any, any>,
  runItemId: string,
  tid: string,
): Promise<{ ok: boolean; error?: string; evidence_created: number }> {
  const t0 = Date.now();

  // 1. Load run item
  const { data: item, error: itemErr } = await srv
    .from("crawler_run_items")
    .select("id,run_id,university_id,website,target_domain,trace_id")
    .eq("id", runItemId)
    .single();

  if (itemErr || !item) {
    return { ok: false, error: "run_item_not_found", evidence_created: 0 };
  }

  const runId   = item.run_id as string;
  const uniId   = item.university_id as string;
  const website = ((item.website as string | null) ?? "").replace(/\/$/, "");
  const domain  = (item.target_domain as string | null) ?? extractDomain(website);
  const traceId = (item.trace_id as string) || tid;

  await tlog(srv, {
    run_id: runId, run_item_id: runItemId, stage: "basic_extract", event_type: "started",
    metadata: { website }, trace_id: traceId,
  });

  // 2. Get homepage raw_page
  const { data: rawPage } = await srv
    .from("raw_pages")
    .select("id,url,text_content,status_code,content_type")
    .eq("url", website)
    .maybeSingle();

  if (!rawPage?.text_content) {
    await tlog(srv, {
      run_id: runId, run_item_id: runItemId, stage: "basic_extract", event_type: "failed",
      success: false, error_type: "no_raw_page", error_message: "No raw page found for homepage",
      trace_id: traceId,
    });
    return { ok: false, error: "no_raw_page", evidence_created: 0 };
  }

  const html       = rawPage.text_content as string;
  const rawPageId  = rawPage.id as number;
  const statusCode = (rawPage.status_code as number | null) ?? 0;

  // 3. Extract fields
  const pageTitle    = extractTitle(html);
  const metaDesc     = extractMetaDescription(html);
  const langCode     = extractLangCode(html);
  const isReachable  = statusCode >= 200 && statusCode < 400;

  // 4. Build evidence_items rows
  type EvidenceRow = {
    crawler_run_id: string; crawler_run_item_id: string; university_id: string;
    entity_type: string; fact_group: string; field_key: string;
    value_raw: string; value_normalized: string | null; source_url: string; source_domain: string;
    raw_page_id: number; content_hash: string; language_code: string | null;
    confidence_0_100: number; trust_level: string; contextual_only: boolean;
    extraction_method: string; extractor_version: string; trace_id: string;
  };

  const evidenceRows: EvidenceRow[] = [];

  async function addEvidence(factGroup: string, fieldKey: string, valueRaw: string, confidence: number) {
    const hashInput = `${uniId}:${factGroup}:${fieldKey}:${valueRaw}:${website}`;
    const contentHash = await sha256hex(hashInput);
    evidenceRows.push({
      crawler_run_id:      runId,
      crawler_run_item_id: runItemId,
      university_id:       uniId,
      entity_type:         "university",
      fact_group:          factGroup,
      field_key:           fieldKey,
      value_raw:           valueRaw,
      value_normalized:    valueRaw,
      source_url:          website,
      source_domain:       domain,
      raw_page_id:         rawPageId,
      content_hash:        contentHash,
      language_code:       langCode,
      confidence_0_100:    confidence,
      trust_level:         "official",
      contextual_only:     false,
      extraction_method:   "static_fetch",
      extractor_version:   EXTRACTOR_VERSION,
      trace_id:            traceId,
    });
  }

  await addEvidence("identity", "homepage_reachable", isReachable ? "true" : "false", 95);
  if (pageTitle) await addEvidence("identity", "page_title", pageTitle, 90);
  if (metaDesc)  await addEvidence("identity", "meta_description", metaDesc, 80);
  if (langCode)  await addEvidence("identity", "language_code", langCode, 85);

  // 5. Insert evidence
  let evidenceCreated = 0;
  if (evidenceRows.length > 0) {
    const { error: insertErr } = await srv.from("evidence_items").insert(evidenceRows);
    if (!insertErr) evidenceCreated = evidenceRows.length;
  }

  await tlog(srv, {
    run_id: runId, run_item_id: runItemId, stage: "basic_extract", event_type: "metric",
    metadata: { evidence_created: evidenceCreated, page_title: pageTitle, lang_code: langCode },
    trace_id: traceId,
  });

  // 6. Update run item
  await srv.from("crawler_run_items").update({
    status:           "evidence_created",
    stage:            "homepage_extracted",
    progress_percent: 60,
    evidence_count:   evidenceCreated,
    updated_at:       new Date().toISOString(),
  }).eq("id", runItemId);

  const durationMs = Date.now() - t0;
  await tlog(srv, {
    run_id: runId, run_item_id: runItemId, stage: "basic_extract", event_type: "completed",
    duration_ms: durationMs, success: true,
    metadata: { evidence_created: evidenceCreated }, trace_id: traceId,
  });

  return { ok: true, evidence_created: evidenceCreated };
}

// ── Deno entry ────────────────────────────────────────────────────────────

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
  try { body = await req.json(); } catch {
    return jsonResp({ ok: false, error: "invalid_json" }, 400, origin);
  }

  const action = body.action as string | undefined;
  slog({ tid, fn: "crawler-v2-basic-extract", action });

  if (action === "extract_homepage") {
    const runItemId = body.run_item_id as string | undefined;
    if (!runItemId) return jsonResp({ ok: false, error: "run_item_id required" }, 400, origin);
    const result = await extractHomepage(srv, runItemId, tid);
    return jsonResp({ ...result, tid }, result.ok ? 200 : 422, origin);
  }

  return jsonResp({ ok: false, error: `unknown action: ${action}` }, 400, origin);
});
