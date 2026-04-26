// ═══════════════════════════════════════════════════════════════
// oryxa-ai-provider — Order 3R
// ───────────────────────────────────────────────────────────────
// Provider-router edge function for ORYXA AI tasks.
//
//   Current provider:  DeepSeek API  (transitional)
//   Future provider:   ORYXA local / self-hosted (not yet wired)
//   Mistral:           DISABLED — never called from this router.
//
// Tasks:
//   • document_extraction          (input: ocr_text  → structured fields)
//   • file_readiness_evaluation    (input: extraction JSON)
//   • russian_translation_draft    (input: extracted fields)
//
// Persistence: writes ONLY to public.oryxa_ai_runs and (optionally,
// for document_extraction with valid JSON + draft_id) to
// public.portal_document_draft_extractions + portal_document_drafts.
// NEVER writes to: customer_files, student-docs, crm_storage,
// document_lane_facts, document_review_queue.
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  resolvePolicy,
  deepseekSupportsRawDocument,
  RAW_DOCUMENT_EXTERNAL_TRANSFER_BLOCKED,
  type OryxaAITask,
  type ResolvedPolicy,
} from "../_shared/oryxa-ai-policy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-portal-trace-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEEPSEEK_BASE = "https://api.deepseek.com";

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function tlog(trace_id: string, stage: string, payload: Record<string, unknown> = {}) {
  try {
    console.log(JSON.stringify({ fn: "oryxa-ai-provider", trace_id, stage, ts: new Date().toISOString(), ...payload }));
  } catch {
    console.log(`[oryxa-ai-provider] trace=${trace_id} stage=${stage}`);
  }
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── Prompts ────────────────────────────────────────────────────

const SYS_EXTRACTION =
  "You are a strict document analyst. Read ONLY the OCR text supplied by the user. " +
  "Never infer or fabricate fields. If a field is not visibly present, set value=null and status=\"missing\" with a short reason (<=140 chars). " +
  "Every extracted/proposed field MUST cite an evidence_id pointing to an entry in evidence_map whose quote is taken verbatim from the OCR text. " +
  "Keep evidence_quote <=180 chars. No markdown. No prose. No comments. No trailing commas. " +
  "Return ONE compact valid JSON object only.";

const SYS_EXTRACTION_COMPACT_RETRY =
  "You are a strict document analyst. Read ONLY the OCR text supplied. " +
  "Return ONE compact valid JSON object only. No markdown, no prose, no comments, no trailing commas. " +
  "evidence_quote <=140 chars. missing_fields[].reason <=100 chars. " +
  "If a field is missing, set value=null, status=\"missing\". " +
  "Every extracted/proposed field MUST have an evidence_id present in evidence_map.";

const SYS_READINESS =
  "You are a document file-readiness evaluator. Input is a JSON object describing already-extracted fields, missing fields, and confidence values. " +
  "Do NOT make any official admission or evaluation claim. " +
  "Every strength, weakness, risk, and recommended_action MUST cite either an evidence_id from the input OR set reason=\"missing_data\". " +
  "Return JSON only.";

const SYS_RU_TRANSLATION =
  "You are a Russian translation drafter for an internal documentation desk. " +
  "Input is extracted fields from an identity/education document. " +
  "Produce a Russian-language draft of those fields. This is NOT a certified translation. " +
  "Every translated field MUST keep its source_key/source_value and reference the same evidence_id from the input. " +
  "Set requires_human_review=true and not_certified_translation=true. Return JSON only.";

function userPromptExtraction(args: { ocrText: string; documentTypeHint?: string | null }): string {
  return [
    `document_type_hint: ${args.documentTypeHint ?? "unknown"}`,
    "",
    "OCR_TEXT_BEGIN",
    args.ocrText.slice(0, 14000),
    "OCR_TEXT_END",
    "",
    "Return JSON with keys:",
    "  document_family (string),",
    "  fields (array of {key,value,confidence,evidence_id,evidence_quote,status}),",
    "  missing_fields (array of {key,reason}),",
    "  quality_flags (array of strings),",
    "  confidence_summary ({overall:number, needs_review:boolean}),",
    "  evidence_map (array of {evidence_id, source:\"ocr_text\", quote})",
  ].join("\n");
}

function userPromptReadiness(extractionJson: unknown): string {
  return [
    "EXTRACTION_JSON_BEGIN",
    JSON.stringify(extractionJson),
    "EXTRACTION_JSON_END",
    "",
    "Return JSON with keys:",
    "  evaluation_status (\"draft\"),",
    "  file_readiness_score (0..100),",
    "  strengths (array of {text, evidence_id?, reason?}),",
    "  weaknesses (array of {text, evidence_id?, reason?}),",
    "  risks (array of {text, evidence_id?, reason?}),",
    "  missing_documents (array of strings),",
    "  recommended_actions (array of {text, evidence_id?, reason?}),",
    "  crm_summary (object),",
    "  confidence (0..1)",
  ].join("\n");
}

function userPromptRussianDraft(fieldsJson: unknown): string {
  return [
    "EXTRACTED_FIELDS_BEGIN",
    JSON.stringify(fieldsJson),
    "EXTRACTED_FIELDS_END",
    "",
    "Return JSON with keys:",
    "  translation_type (\"russian_translation_ready_draft\"),",
    "  source_language (string),",
    "  target_language (\"ru\"),",
    "  fields_ru (array of {source_key, source_value, ru_label, ru_value, evidence_id}),",
    "  layout_notes (array of strings),",
    "  requires_human_review (true),",
    "  not_certified_translation (true)",
  ].join("\n");
}

// ─── DeepSeek call ──────────────────────────────────────────────

interface DeepSeekResult {
  json: unknown;
  raw: string;
  tokens_in?: number;
  tokens_out?: number;
  http_status: number;
  finish_reason?: string;
  content_length: number;
  latency_ms: number;
}

interface DeepSeekParseFailure {
  kind: "parse_failure";
  http_status: number;
  latency_ms: number;
  content_length: number;
  finish_reason?: string;
  tokens_in?: number;
  tokens_out?: number;
  raw_envelope_length: number;
  content_first_300: string;
  content_last_300: string;
  parse_error: string;
}

function getDocumentExtractionMaxTokens(): number {
  const raw = Deno.env.get("ORYXA_DOCUMENT_EXTRACTION_MAX_TOKENS");
  if (!raw) return 6000;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 512 || n > 16000) return 6000;
  return Math.floor(n);
}

async function callDeepSeek(args: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  trace_id: string;
  maxTokens: number;
}): Promise<DeepSeekResult | DeepSeekParseFailure> {
  const callStart = Date.now();
  const r = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: args.model,
      temperature: 0,
      max_tokens: args.maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: args.systemPrompt },
        { role: "user", content: args.userPrompt },
      ],
    }),
  });

  const text = await r.text();
  const latency_ms = Date.now() - callStart;
  if (!r.ok) {
    throw new Error(`deepseek_http_${r.status}:${text.slice(0, 240)}`);
  }
  let payload: any;
  try {
    payload = JSON.parse(text);
  } catch (e) {
    throw new Error("deepseek_envelope_bad_json:" + (e as Error).message);
  }
  const content: string | undefined = payload?.choices?.[0]?.message?.content;
  const finish_reason: string | undefined = payload?.choices?.[0]?.finish_reason;
  const tokens_in: number | undefined = payload?.usage?.prompt_tokens;
  const tokens_out: number | undefined = payload?.usage?.completion_tokens;
  const tokens_total: number | undefined = payload?.usage?.total_tokens;
  const content_length = typeof content === "string" ? content.length : 0;

  // Diagnostics BEFORE JSON.parse(content)
  tlog(args.trace_id, "deepseek_response_diag", {
    http_status: r.status,
    latency_ms,
    model: args.model,
    finish_reason: finish_reason ?? null,
    prompt_tokens: tokens_in ?? null,
    completion_tokens: tokens_out ?? null,
    total_tokens: tokens_total ?? null,
    raw_envelope_length: text.length,
    message_content_length: content_length,
    content_first_300: typeof content === "string" ? content.slice(0, 300) : null,
    content_last_300: typeof content === "string" ? content.slice(-300) : null,
    parse_target: "message.content",
    max_tokens_requested: args.maxTokens,
  });

  if (!content) throw new Error("deepseek_no_content");
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    return {
      kind: "parse_failure",
      http_status: r.status,
      latency_ms,
      content_length,
      finish_reason,
      tokens_in,
      tokens_out,
      raw_envelope_length: text.length,
      content_first_300: content.slice(0, 300),
      content_last_300: content.slice(-300),
      parse_error: (e as Error).message,
    };
  }
  return {
    json: parsed,
    raw: content,
    tokens_in,
    tokens_out,
    http_status: r.status,
    finish_reason,
    content_length,
    latency_ms,
  };
}

// ─── Output validators ──────────────────────────────────────────

function validateExtractionOutput(o: any): { ok: boolean; error?: string } {
  if (!o || typeof o !== "object") return { ok: false, error: "extraction_output_not_object" };
  if (typeof o.document_family !== "string") return { ok: false, error: "missing_document_family" };
  if (!Array.isArray(o.fields)) return { ok: false, error: "fields_not_array" };
  if (!Array.isArray(o.evidence_map)) return { ok: false, error: "evidence_map_not_array" };
  const evidenceIds = new Set<string>(
    o.evidence_map.map((e: any) => (typeof e?.evidence_id === "string" ? e.evidence_id : "")).filter(Boolean),
  );
  for (const f of o.fields) {
    if (typeof f?.key !== "string") return { ok: false, error: "field_missing_key" };
    const status = f?.status;
    const claimed = status === "extracted" || status === "proposed";
    if (claimed) {
      if (!f.evidence_id || !evidenceIds.has(f.evidence_id)) {
        return { ok: false, error: `field_${f.key}_missing_evidence_id` };
      }
    }
  }
  return { ok: true };
}

function validateReadinessOutput(o: any): { ok: boolean; error?: string } {
  if (!o || typeof o !== "object") return { ok: false, error: "readiness_output_not_object" };
  for (const k of ["strengths", "weaknesses", "risks", "recommended_actions"]) {
    if (!Array.isArray(o[k])) return { ok: false, error: `${k}_not_array` };
    for (const it of o[k]) {
      const hasEvidence = typeof it?.evidence_id === "string" && it.evidence_id.length > 0;
      const hasReason = it?.reason === "missing_data" || (typeof it?.reason === "string" && it.reason.length > 0);
      if (!hasEvidence && !hasReason) {
        return { ok: false, error: `${k}_item_unbacked` };
      }
    }
  }
  return { ok: true };
}

function validateRussianDraftOutput(o: any): { ok: boolean; error?: string } {
  if (!o || typeof o !== "object") return { ok: false, error: "ru_output_not_object" };
  if (o.target_language !== "ru") return { ok: false, error: "target_language_not_ru" };
  if (o.requires_human_review !== true) return { ok: false, error: "requires_human_review_not_true" };
  if (o.not_certified_translation !== true) return { ok: false, error: "not_certified_translation_not_true" };
  if (!Array.isArray(o.fields_ru)) return { ok: false, error: "fields_ru_not_array" };
  return { ok: true };
}

// ─── Run-log writer ─────────────────────────────────────────────

async function writeRun(
  admin: any,
  row: {
    student_user_id: string | null;
    draft_id: string | null;
    task_type: OryxaAITask;
    policy: ResolvedPolicy;
    input_hash: string;
    output_hash: string | null;
    status: "ok" | "validation_failed" | "provider_error" | "blocked";
    tokens_in: number | null;
    tokens_out: number | null;
    latency_ms: number;
    trace_id: string;
    error: string | null;
  },
) {
  try {
    await admin.from("oryxa_ai_runs").insert({
      student_user_id: row.student_user_id,
      draft_id: row.draft_id,
      task_type: row.task_type,
      provider: row.policy.provider,
      provider_mode: row.policy.mode,
      model: row.policy.model,
      input_hash: row.input_hash,
      output_hash: row.output_hash,
      status: row.status,
      tokens_in: row.tokens_in,
      tokens_out: row.tokens_out,
      latency_ms: row.latency_ms,
      trace_id: row.trace_id,
      error: row.error,
    });
  } catch (e) {
    tlog(row.trace_id, "run_log_write_failed", { error: (e as Error).message });
  }
}

// ─── Handler ────────────────────────────────────────────────────

interface RequestBody {
  task_type?: OryxaAITask;
  trace_id?: string;
  // document_extraction
  ocr_text?: string;
  document_type_hint?: string | null;
  raw_document?: unknown; // hard-blocked
  signed_url?: unknown; // hard-blocked
  // shared
  draft_id?: string | null;
  // file_readiness_evaluation
  extraction?: unknown;
  // russian_translation_draft
  fields?: unknown;
  source_language?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonRes({ ok: false, error: "method_not_allowed" }, 405);

  const t0 = Date.now();
  const trace_id_hdr = req.headers.get("x-portal-trace-id");

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonRes({ ok: false, error: "invalid_json" }, 400);
  }

  const trace_id = body.trace_id ?? trace_id_hdr ?? `oryxa_${crypto.randomUUID()}`;
  const task_type = body.task_type;
  if (!task_type) {
    return jsonRes({ ok: false, error: "missing_task_type", trace_id }, 400);
  }

  // Hard prohibition: raw documents must never be forwarded to external providers.
  if (body.raw_document !== undefined || body.signed_url !== undefined) {
    return jsonRes(
      {
        ok: false,
        error: RAW_DOCUMENT_EXTERNAL_TRANSFER_BLOCKED,
        provider_supports_raw: deepseekSupportsRawDocument(),
        fallback_required: "ocr_text_json_mode",
        trace_id,
      },
      400,
    );
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const policy = resolvePolicy({
    ORYXA_AI_PROVIDER_MODE: Deno.env.get("ORYXA_AI_PROVIDER_MODE"),
    ORYXA_AI_PROVIDER: Deno.env.get("ORYXA_AI_PROVIDER"),
    ORYXA_AI_MODEL: Deno.env.get("ORYXA_AI_MODEL"),
    DEEPSEEK_API_KEY: Deno.env.get("DEEPSEEK_API_KEY"),
  });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Authenticate caller (JWT validated in code; verify_jwt off in config).
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  let user_id: string | null = null;
  if (token) {
    try {
      const { data } = await admin.auth.getUser(token);
      user_id = data?.user?.id ?? null;
    } catch {
      user_id = null;
    }
  }
  if (!user_id) {
    return jsonRes({ ok: false, error: "unauthorized", trace_id }, 401);
  }

  // Provider gate.
  if (!policy.enabled) {
    const mappedError =
      policy.blocked_reason === "deepseek_api_key_missing"
        ? "local_ai_provider_not_configured"
        : policy.blocked_reason ?? "provider_disabled";
    const input_hash = await sha256Hex(JSON.stringify({ task_type, body }));
    await writeRun(admin, {
      student_user_id: user_id,
      draft_id: body.draft_id ?? null,
      task_type,
      policy,
      input_hash,
      output_hash: null,
      status: "blocked",
      tokens_in: null,
      tokens_out: null,
      latency_ms: Date.now() - t0,
      trace_id,
      error: mappedError,
    });
    return jsonRes(
      {
        ok: false,
        error: mappedError,
        provider_mode: policy.mode,
        provider: policy.provider,
        trace_id,
      },
      503,
    );
  }

  const apiKey = Deno.env.get("DEEPSEEK_API_KEY")!;

  // Build prompts per task.
  let systemPrompt = "";
  let userPrompt = "";
  let inputCanonical = "";
  switch (task_type) {
    case "document_extraction": {
      if (typeof body.ocr_text !== "string" || body.ocr_text.trim().length === 0) {
        return jsonRes({ ok: false, error: "missing_ocr_text", trace_id }, 400);
      }
      systemPrompt = SYS_EXTRACTION;
      userPrompt = userPromptExtraction({ ocrText: body.ocr_text, documentTypeHint: body.document_type_hint ?? null });
      inputCanonical = JSON.stringify({ task_type, ocr_text: body.ocr_text, hint: body.document_type_hint ?? null });
      break;
    }
    case "file_readiness_evaluation": {
      if (!body.extraction || typeof body.extraction !== "object") {
        return jsonRes({ ok: false, error: "missing_extraction_input", trace_id }, 400);
      }
      systemPrompt = SYS_READINESS;
      userPrompt = userPromptReadiness(body.extraction);
      inputCanonical = JSON.stringify({ task_type, extraction: body.extraction });
      break;
    }
    case "russian_translation_draft": {
      if (!body.fields || (typeof body.fields !== "object" && !Array.isArray(body.fields))) {
        return jsonRes({ ok: false, error: "missing_fields_input", trace_id }, 400);
      }
      systemPrompt = SYS_RU_TRANSLATION;
      userPrompt = userPromptRussianDraft({ source_language: body.source_language ?? null, fields: body.fields });
      inputCanonical = JSON.stringify({ task_type, fields: body.fields, src: body.source_language ?? null });
      break;
    }
    default:
      return jsonRes({ ok: false, error: "unknown_task_type", trace_id }, 400);
  }

  const input_hash = await sha256Hex(inputCanonical);

  // Call provider.
  let providerResult: DeepSeekResult;
  try {
    tlog(trace_id, "provider_call_started", { provider: policy.provider, model: policy.model, task_type });
    providerResult = await callDeepSeek({
      apiKey,
      model: policy.model,
      systemPrompt,
      userPrompt,
      trace_id,
    });
    tlog(trace_id, "provider_call_ok", { tokens_in: providerResult.tokens_in, tokens_out: providerResult.tokens_out });
  } catch (e) {
    const msg = (e as Error).message;
    await writeRun(admin, {
      student_user_id: user_id,
      draft_id: body.draft_id ?? null,
      task_type,
      policy,
      input_hash,
      output_hash: null,
      status: "provider_error",
      tokens_in: null,
      tokens_out: null,
      latency_ms: Date.now() - t0,
      trace_id,
      error: msg.slice(0, 500),
    });
    return jsonRes({ ok: false, error: "provider_error", detail: msg, trace_id }, 502);
  }

  // Validate output.
  const output = providerResult.json as any;
  let validation: { ok: boolean; error?: string };
  if (task_type === "document_extraction") validation = validateExtractionOutput(output);
  else if (task_type === "file_readiness_evaluation") validation = validateReadinessOutput(output);
  else validation = validateRussianDraftOutput(output);

  const output_hash = await sha256Hex(providerResult.raw);

  if (!validation.ok) {
    await writeRun(admin, {
      student_user_id: user_id,
      draft_id: body.draft_id ?? null,
      task_type,
      policy,
      input_hash,
      output_hash,
      status: "validation_failed",
      tokens_in: providerResult.tokens_in ?? null,
      tokens_out: providerResult.tokens_out ?? null,
      latency_ms: Date.now() - t0,
      trace_id,
      error: validation.error ?? "validation_failed",
    });
    return jsonRes(
      { ok: false, error: "validation_failed", detail: validation.error, trace_id, raw: output },
      422,
    );
  }

  // Optional persistence: extraction → portal_document_draft_extractions
  let persisted_to_draft = false;
  if (task_type === "document_extraction" && body.draft_id) {
    try {
      // Verify draft ownership.
      const { data: draft, error: dErr } = await admin
        .from("portal_document_drafts")
        .select("id, student_user_id, draft_storage_bucket, discarded_at, shared_to_crm_at")
        .eq("id", body.draft_id)
        .single();
      if (!dErr && draft && draft.student_user_id === user_id && !draft.discarded_at && !draft.shared_to_crm_at) {
        const family = String(output.document_family ?? "unknown_document");
        const factsArr = Array.isArray(output.fields) ? output.fields : [];
        const facts: Record<string, unknown> = {};
        for (const f of factsArr) {
          if (typeof f?.key === "string") {
            facts[f.key] = {
              value: f.value ?? null,
              confidence: typeof f.confidence === "number" ? f.confidence : 0,
              source: "deepseek_api",
              status: f.status ?? (f.value == null ? "missing" : "proposed"),
              evidence_id: f.evidence_id ?? null,
              evidence_quote: f.evidence_quote ?? null,
            };
          }
        }
        const overall = Number(output?.confidence_summary?.overall ?? 0);
        const truth_state =
          output?.confidence_summary?.needs_review === false && overall >= 0.75
            ? "extracted"
            : overall >= 0.55
              ? "proposed"
              : "needs_review";

        const engine_metadata = {
          producer: "oryxa-ai-provider-v1",
          provider: policy.provider,
          provider_mode: policy.mode,
          model: policy.model,
          input_hash,
          output_hash,
          trace_id,
          schema_version: "v1",
          quality_flags: output?.quality_flags ?? [],
          missing_fields: output?.missing_fields ?? [],
          evidence_map: output?.evidence_map ?? [],
        };

        await admin.from("portal_document_draft_extractions").upsert(
          {
            draft_id: body.draft_id,
            student_user_id: user_id,
            family,
            family_confidence: overall,
            is_recognized: family !== "unknown_document",
            rejection_reason: null,
            truth_state,
            lane_confidence: overall,
            facts: facts as Record<string, unknown>,
            engine_metadata,
            trace_id,
          },
          { onConflict: "draft_id" },
        );

        await admin
          .from("portal_document_drafts")
          .update({
            extraction_status: "extraction_completed",
            extraction_completed_at: new Date().toISOString(),
            extraction_trace_id: trace_id,
            extraction_error: null,
          })
          .eq("id", body.draft_id);

        persisted_to_draft = true;
      }
    } catch (e) {
      tlog(trace_id, "draft_persist_failed", { error: (e as Error).message });
    }
  }

  await writeRun(admin, {
    student_user_id: user_id,
    draft_id: body.draft_id ?? null,
    task_type,
    policy,
    input_hash,
    output_hash,
    status: "ok",
    tokens_in: providerResult.tokens_in ?? null,
    tokens_out: providerResult.tokens_out ?? null,
    latency_ms: Date.now() - t0,
    trace_id,
    error: null,
  });

  return jsonRes({
    ok: true,
    task_type,
    provider: policy.provider,
    provider_mode: policy.mode,
    model: policy.model,
    trace_id,
    persisted_to_draft,
    output: {
      ...output,
      provider: policy.provider,
      model: policy.model,
      trace_id,
    },
  });
});
