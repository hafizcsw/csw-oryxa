import { createClient } from "@supabase/supabase-js";
import {
  handleCorsPreflight,
  getCorsHeaders,
  generateTraceId,
  slog,
} from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/adminGuard.ts";

// ── Constants ──────────────────────────────────────────────────────────────

const MAPPER_VERSION      = "5.0";
const METHODOLOGY_VERSION = "1.1";

// Trust level mapping for official website evidence
const TRUST_LEVEL_MAP: Record<string, string> = {
  official:   "high",
  verified:   "high",
  inferred:   "medium",
  unverified: "low",
};

type EventType = "started" | "completed" | "failed" | "warning" | "metric";

// ── Helpers ────────────────────────────────────────────────────────────────

function jsonResp(data: unknown, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...getCorsHeaders(origin) },
  });
}

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function tlog(
  srv: ReturnType<typeof createClient>,
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
    metadata: { mapper_version: MAPPER_VERSION, ...p.metadata },
    trace_id: p.trace_id,
  });
}

// ── Main: map_orx ──────────────────────────────────────────────────────────

async function mapOrx(
  srv: ReturnType<typeof createClient>,
  runItemId: string,
  tid: string,
): Promise<{ ok: boolean; error?: string; mapped: number; orx_ingested: number }> {
  const t0 = Date.now();

  // 1. Load run item
  const { data: item, error: itemErr } = await srv
    .from("crawler_run_items")
    .select("id,run_id,university_id,website,target_domain,trace_id")
    .eq("id", runItemId)
    .single();

  if (itemErr || !item) {
    return { ok: false, error: "run_item_not_found", mapped: 0, orx_ingested: 0 };
  }

  const runId   = item.run_id as string;
  const uniId   = item.university_id as string;
  const website = ((item.website as string | null) ?? "").replace(/\/$/, "");
  const domain  = ((item.target_domain as string | null) ?? "").replace(/^www\./, "");
  const traceId = (item.trace_id as string) || tid;

  await tlog(srv, {
    run_id: runId, run_item_id: runItemId, stage: "orx_mapper", event_type: "started",
    trace_id: traceId,
  });

  // 2. Load evidence_items without ORX mapping
  const { data: evidenceRaw } = await srv
    .from("evidence_items")
    .select("id,fact_group,field_key,value_raw,source_url,source_domain,content_hash,trust_level,confidence_0_100,language_code")
    .eq("crawler_run_item_id", runItemId)
    .is("orx_layer", null)
    .limit(500);

  const evidence = (evidenceRaw ?? []) as Array<{
    id: string; fact_group: string; field_key: string; value_raw: string;
    source_url: string; source_domain: string; content_hash: string;
    trust_level: string; confidence_0_100: number; language_code: string | null;
  }>;

  if (evidence.length === 0) {
    await tlog(srv, {
      run_id: runId, run_item_id: runItemId, stage: "orx_mapper", event_type: "completed",
      success: true, metadata: { mapped: 0, reason: "no_unmapped_evidence" }, trace_id: traceId,
    });
    return { ok: true, mapped: 0, orx_ingested: 0 };
  }

  // 3. Load active mapping rules
  const { data: rulesRaw } = await srv
    .from("orx_mapping_rules")
    .select("fact_group,field_key,orx_layer,orx_signal_family,confidence_boost,requires_manual_review")
    .eq("active", true);

  const rules = (rulesRaw ?? []) as Array<{
    fact_group: string; field_key: string; orx_layer: string;
    orx_signal_family: string; confidence_boost: number; requires_manual_review: boolean;
  }>;

  // Build lookup: "fact_group:field_key" → rule
  const ruleMap = new Map(rules.map((r) => [`${r.fact_group}:${r.field_key}`, r]));

  // 4. Map each evidence item
  let mapped    = 0;
  let ingested  = 0;

  for (const ev of evidence) {
    const rule = ruleMap.get(`${ev.fact_group}:${ev.field_key}`);
    if (!rule) continue;

    // Update evidence_items with ORX layer/family
    await srv.from("evidence_items").update({
      orx_layer:         rule.orx_layer,
      orx_signal_family: rule.orx_signal_family,
      updated_at:        new Date().toISOString(),
    }).eq("id", ev.id);

    mapped++;

    // 5. Ingest into orx_evidence
    const orxTrustLevel = TRUST_LEVEL_MAP[ev.trust_level] ?? "low";
    const confidence    = Math.min(100, ev.confidence_0_100 + (rule.confidence_boost ?? 0));
    const contentHash   = await sha256hex(`${uniId}:${rule.orx_signal_family}:${ev.content_hash}`);

    const { data: orxRow, error: ingestErr } = await srv
      .from("orx_evidence")
      .upsert({
        entity_type:             "university",
        entity_id:               uniId,
        layer:                   rule.orx_layer,
        signal_family:           rule.orx_signal_family,
        source_type:             "official_website",
        source_url:              ev.source_url,
        source_domain:           ev.source_domain || domain,
        trust_level:             orxTrustLevel,
        snippet:                 ev.value_raw.slice(0, 500),
        language_code:           ev.language_code ?? "en",
        content_hash:            contentHash,
        extraction_confidence:   confidence,
        evidence_status:         rule.requires_manual_review ? "fetched" : "normalized",
        methodology_version:     METHODOLOGY_VERSION,
        contextual_only:         false,
      }, {
        onConflict: "entity_type,entity_id,content_hash",
        ignoreDuplicates: true,
      })
      .select("id")
      .single();

    if (!ingestErr && orxRow?.id) {
      // Back-link evidence_item → orx_evidence
      await srv.from("evidence_items").update({
        orx_evidence_id: orxRow.id,
      }).eq("id", ev.id);
      ingested++;
    }
  }

  await tlog(srv, {
    run_id: runId, run_item_id: runItemId, stage: "orx_mapper", event_type: "metric",
    metadata: { mapped, ingested, evidence_total: evidence.length, rules_active: rules.length },
    trace_id: traceId,
  });

  // 6. Update run item
  await srv.from("crawler_run_items").update({
    status:            "needs_review",
    stage:             "orx_mapped",
    progress_percent:  90,
    orx_signal_count:  ingested,
    updated_at:        new Date().toISOString(),
  }).eq("id", runItemId);

  const durationMs = Date.now() - t0;
  await tlog(srv, {
    run_id: runId, run_item_id: runItemId, stage: "orx_mapper", event_type: "completed",
    duration_ms: durationMs, success: true,
    metadata: { mapped, orx_ingested: ingested }, trace_id: traceId,
  });

  return { ok: true, mapped, orx_ingested: ingested };
}

// ── Batch map by run (maps all items in a run) ─────────────────────────────

async function mapOrxBatchByRun(
  srv: ReturnType<typeof createClient>,
  runId: string,
  tid: string,
): Promise<{ ok: boolean; error?: string; items_processed: number; total_mapped: number; total_ingested: number }> {
  const { data: items } = await srv
    .from("crawler_run_items")
    .select("id")
    .eq("run_id", runId)
    .in("status", ["evidence_created", "draft_created"]);

  if (!items || items.length === 0) {
    return { ok: true, items_processed: 0, total_mapped: 0, total_ingested: 0 };
  }

  let totalMapped   = 0;
  let totalIngested = 0;

  for (const item of items) {
    const result = await mapOrx(srv, item.id as string, tid);
    if (result.ok) {
      totalMapped   += result.mapped;
      totalIngested += result.orx_ingested;
    }
  }

  return { ok: true, items_processed: items.length, total_mapped: totalMapped, total_ingested: totalIngested };
}

// ── Deno entry ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get("origin");
  const tid    = req.headers.get("x-client-trace-id") || generateTraceId();

  const adminErr = await requireAdmin(req);
  if (adminErr) return adminErr;

  const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const srv = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return jsonResp({ ok: false, error: "invalid_json" }, 400, origin);
  }

  const action = body.action as string | undefined;
  slog({ tid, fn: "crawler-v2-orx-mapper", action });

  if (action === "map_orx") {
    const runItemId = body.run_item_id as string | undefined;
    if (!runItemId) return jsonResp({ ok: false, error: "run_item_id required" }, 400, origin);
    const result = await mapOrx(srv, runItemId, tid);
    return jsonResp({ ...result, tid }, result.ok ? 200 : 422, origin);
  }

  if (action === "map_orx_batch") {
    const runId = body.run_id as string | undefined;
    if (!runId) return jsonResp({ ok: false, error: "run_id required" }, 400, origin);
    const result = await mapOrxBatchByRun(srv, runId, tid);
    return jsonResp({ ...result, tid }, result.ok ? 200 : 422, origin);
  }

  return jsonResp({ ok: false, error: `unknown action: ${action}` }, 400, origin);
});
