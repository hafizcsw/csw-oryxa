import type { SupabaseClient } from "@supabase/supabase-js";
import {
  handleCorsPreflight,
  getCorsHeaders,
  generateTraceId,
  slog,
} from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/adminGuard.ts";
import { resolvePolicy } from "../_shared/oryxa-ai-policy.ts";

// ── Constants ──────────────────────────────────────────────────────────────

const EXTRACTOR_VERSION = "3.0";
const DEEPSEEK_BASE     = "https://api.deepseek.com";
const MAX_PAGE_CHARS    = 12_000;
const AI_TIMEOUT_MS     = 60_000;

// ── Prompt templates ───────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a strict university data extractor.
Read ONLY the page text supplied. Never fabricate data.
For each field: if clearly present set value and confidence 0-100; if absent set value=null.
Return ONE compact JSON object only. No markdown, no prose, no trailing commas.`;

function buildUserPrompt(pageText: string, website: string): string {
  return [
    `Website: ${website}`,
    "",
    "PAGE_TEXT_BEGIN",
    pageText.slice(0, MAX_PAGE_CHARS),
    "PAGE_TEXT_END",
    "",
    "Return JSON with key \"facts\" — an array of objects:",
    `{fact_group: string, field_key: string, value: string|null, confidence: number(0-100), quote: string|null}`,
    "",
    "Fact groups and field keys to extract:",
    "identity: official_name, country, city, founded_year, accreditation_body",
    "contact_location: address, phone, email, map_url",
    "admissions: application_deadline, entry_requirements, min_gpa, ielts_score, toefl_score",
    "tuition_fees: annual_tuition_usd, currency, tuition_basis, application_fee",
    "programs: total_programs_count, degree_levels_offered",
    "housing: on_campus_housing, housing_url",
    "student_life: international_students_pct, campus_size_description",
  ].join("\n");
}

// ── Types ──────────────────────────────────────────────────────────────────

type EventType = "started" | "completed" | "failed" | "warning" | "metric";

interface AiFact {
  fact_group: string;
  field_key: string;
  value: string | null;
  confidence: number;
  quote: string | null;
}

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

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

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

// ── DeepSeek call ──────────────────────────────────────────────────────────

async function callDeepSeek(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<{ facts: AiFact[] | null; raw: string; tokens_in: number; tokens_out: number; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 4096,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt   },
        ],
      }),
    });

    const envelope = await res.json() as Record<string, unknown>;
    const content  = (envelope?.choices as Array<Record<string, unknown>>)?.[0]?.message as Record<string, unknown>;
    const raw      = (content?.content as string) ?? "";
    const usage    = envelope?.usage as Record<string, number> | undefined;

    // Strip markdown fences if present
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

    let facts: AiFact[] | null = null;
    try {
      const parsed = JSON.parse(cleaned) as Record<string, unknown>;
      if (Array.isArray(parsed.facts)) {
        facts = parsed.facts as AiFact[];
      }
    } catch (e) {
      return {
        facts: null, raw,
        tokens_in: usage?.prompt_tokens ?? 0,
        tokens_out: usage?.completion_tokens ?? 0,
        error: `json_parse_failed: ${e}`,
      };
    }

    return {
      facts,
      raw,
      tokens_in:  usage?.prompt_tokens     ?? 0,
      tokens_out: usage?.completion_tokens ?? 0,
    };
  } catch (e) {
    return { facts: null, raw: "", tokens_in: 0, tokens_out: 0, error: String(e) };
  } finally {
    clearTimeout(timer);
  }
}

// ── Main: ai_extract ───────────────────────────────────────────────────────

async function aiExtract(
  srv: SupabaseClient<any, any, any>,
  runItemId: string,
  tid: string,
): Promise<{ ok: boolean; error?: string; evidence_created: number; ai_enabled: boolean }> {
  const t0 = Date.now();

  // Resolve AI policy
  const policy = resolvePolicy({
    ORYXA_AI_PROVIDER_MODE: Deno.env.get("ORYXA_AI_PROVIDER_MODE"),
    ORYXA_AI_PROVIDER:      Deno.env.get("ORYXA_AI_PROVIDER"),
    ORYXA_AI_MODEL:         Deno.env.get("ORYXA_AI_MODEL"),
    DEEPSEEK_API_KEY:       Deno.env.get("DEEPSEEK_API_KEY"),
  });

  if (!policy.enabled) {
    slog({ tid, fn: "crawler-v2-ai-extract", msg: "ai_disabled", reason: policy.blocked_reason });
    return { ok: true, evidence_created: 0, ai_enabled: false };
  }

  // 1. Load run item
  const { data: item, error: itemErr } = await srv
    .from("crawler_run_items")
    .select("id,run_id,university_id,website,target_domain,trace_id")
    .eq("id", runItemId)
    .single();

  if (itemErr || !item) {
    return { ok: false, error: "run_item_not_found", evidence_created: 0, ai_enabled: true };
  }

  const runId   = item.run_id as string;
  const uniId   = item.university_id as string;
  const website = ((item.website as string | null) ?? "").replace(/\/$/, "");
  const domain  = (item.target_domain as string | null) ?? extractDomain(website);
  const traceId = (item.trace_id as string) || tid;

  await tlog(srv, {
    run_id: runId, run_item_id: runItemId, stage: "ai_extract", event_type: "started",
    metadata: { model: policy.model, provider: policy.provider }, trace_id: traceId,
  });

  // 2. Get homepage raw_page
  const { data: rawPage } = await srv
    .from("raw_pages")
    .select("id,url,text_content")
    .eq("url", website)
    .maybeSingle();

  if (!rawPage?.text_content) {
    await tlog(srv, {
      run_id: runId, run_item_id: runItemId, stage: "ai_extract", event_type: "failed",
      success: false, error_type: "no_raw_page", trace_id: traceId,
    });
    return { ok: false, error: "no_raw_page", evidence_created: 0, ai_enabled: true };
  }

  const html      = rawPage.text_content as string;
  const rawPageId = rawPage.id as number;

  // Strip HTML tags for AI consumption
  const pageText = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
                       .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
                       .replace(/<[^>]+>/g, " ")
                       .replace(/\s+/g, " ")
                       .trim();

  // 3. Call AI
  const apiKey = Deno.env.get("DEEPSEEK_API_KEY")!;
  const aiResult = await callDeepSeek(
    apiKey,
    policy.model,
    SYSTEM_PROMPT,
    buildUserPrompt(pageText, website),
  );

  await tlog(srv, {
    run_id: runId, run_item_id: runItemId, stage: "ai_extract", event_type: "metric",
    metadata: {
      tokens_in: aiResult.tokens_in, tokens_out: aiResult.tokens_out,
      facts_count: aiResult.facts?.length ?? 0, ai_error: aiResult.error,
    },
    trace_id: traceId,
  });

  if (aiResult.error || !aiResult.facts) {
    await tlog(srv, {
      run_id: runId, run_item_id: runItemId, stage: "ai_extract", event_type: "failed",
      success: false, error_type: "ai_parse_failed", error_message: aiResult.error,
      trace_id: traceId,
    });
    return { ok: false, error: aiResult.error ?? "ai_parse_failed", evidence_created: 0, ai_enabled: true };
  }

  // 4. Build evidence_items rows
  const evidenceRows: Record<string, unknown>[] = [];

  for (const fact of aiResult.facts) {
    if (!fact.value || !fact.fact_group || !fact.field_key) continue;

    const hashInput   = `${uniId}:${fact.fact_group}:${fact.field_key}:${fact.value}:${website}:ai`;
    const contentHash = await sha256hex(hashInput);
    const confidence  = Math.min(100, Math.max(0, Math.round(fact.confidence ?? 50)));

    evidenceRows.push({
      crawler_run_id:      runId,
      crawler_run_item_id: runItemId,
      university_id:       uniId,
      entity_type:         "university",
      fact_group:          fact.fact_group,
      field_key:           fact.field_key,
      value_raw:           String(fact.value),
      value_normalized:    String(fact.value),
      evidence_quote:      fact.quote ?? null,
      source_url:          website,
      source_domain:       domain,
      raw_page_id:         rawPageId,
      content_hash:        contentHash,
      confidence_0_100:    confidence,
      trust_level:         "inferred",
      contextual_only:     false,
      extraction_method:   "ai_extraction",
      extractor_version:   EXTRACTOR_VERSION,
      model_provider:      policy.provider,
      model_name:          policy.model,
      trace_id:            traceId,
    });
  }

  // 5. Insert evidence
  let evidenceCreated = 0;
  if (evidenceRows.length > 0) {
    const { error: insertErr } = await srv.from("evidence_items").insert(evidenceRows);
    if (!insertErr) evidenceCreated = evidenceRows.length;
  }

  // 6. Update run item
  await srv.from("crawler_run_items").update({
    status:           "ai_extracting",
    stage:            "ai_extracted",
    progress_percent: 75,
    updated_at:       new Date().toISOString(),
  }).eq("id", runItemId);

  const durationMs = Date.now() - t0;
  await tlog(srv, {
    run_id: runId, run_item_id: runItemId, stage: "ai_extract", event_type: "completed",
    duration_ms: durationMs, success: true,
    metadata: { evidence_created: evidenceCreated, tokens_in: aiResult.tokens_in, tokens_out: aiResult.tokens_out },
    trace_id: traceId,
  });

  return { ok: true, evidence_created: evidenceCreated, ai_enabled: true };
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
  slog({ tid, fn: "crawler-v2-ai-extract", action });

  if (action === "ai_extract") {
    const runItemId = body.run_item_id as string | undefined;
    if (!runItemId) return jsonResp({ ok: false, error: "run_item_id required" }, 400, origin);
    const result = await aiExtract(srv, runItemId, tid);
    return jsonResp({ ...result, tid }, result.ok ? 200 : 422, origin);
  }

  return jsonResp({ ok: false, error: `unknown action: ${action}` }, 400, origin);
});
