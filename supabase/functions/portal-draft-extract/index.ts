// ═══════════════════════════════════════════════════════════════
// portal-draft-extract — Order 3
// ───────────────────────────────────────────────────────────────
// Runs Mistral OCR + LLM extraction on a portal draft file.
// STRICTLY draft-scoped:
//   • Reads from `portal-drafts` storage bucket only.
//   • Writes ONLY to public.portal_document_draft_extractions
//     and public.portal_document_drafts (extraction_* columns).
//   • NEVER touches: customer_files, student-docs, document_lane_facts,
//     document_review_queue, or any CRM table.
//
// Request: { draft_id: string }
// Response: { ok, draft_id, extraction_status, family?, trace_id, error? }
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-portal-trace-id",
};

const MISTRAL_API = "https://api.mistral.ai/v1";
const OCR_MODEL = "mistral-ocr-latest";
const LLM_MODEL = "mistral-small-latest";
const PIPELINE_VERSION = "portal-draft-extract-v1";

type Family =
  | "passport_id"
  | "graduation_certificate"
  | "language_certificate"
  | "academic_transcript"
  | "unknown_document";

interface CanonicalField {
  value: string | null;
  confidence: number;
  source: string;
  status: "extracted" | "proposed" | "missing" | "needs_review";
  raw?: string | null;
}

function tlog(trace_id: string, stage: string, payload: Record<string, unknown> = {}) {
  try {
    console.log(JSON.stringify({ trace_id, stage, ts: new Date().toISOString(), ...payload }));
  } catch {
    console.log(`[portal-draft-extract] trace=${trace_id} stage=${stage}`);
  }
}

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function familyFromHint(hint: string | null | undefined): Family {
  if (!hint) return "unknown_document";
  const k = hint.toLowerCase();
  if (k.includes("passport")) return "passport_id";
  if (k.includes("graduation") || k.includes("diploma")) return "graduation_certificate";
  if (k.includes("language") || k === "ielts" || k === "toefl") return "language_certificate";
  if (k.includes("transcript")) return "academic_transcript";
  return "unknown_document";
}

function requiredFieldsFor(f: Family): string[] {
  if (f === "passport_id") return ["full_name", "passport_number", "nationality", "date_of_birth", "expiry_date", "issuing_country"];
  if (f === "graduation_certificate") return ["full_name", "institution_name", "qualification", "issue_date"];
  if (f === "language_certificate") return ["full_name", "test_name", "overall_score", "test_date"];
  return [];
}

function aggregate(facts: Record<string, CanonicalField>, required: string[]) {
  const reqFields = required.map((k) => facts[k]).filter(Boolean);
  if (reqFields.length === 0) {
    return { truth_state: "needs_review" as const, lane_confidence: 0 };
  }
  const anyMissing = reqFields.some((f) => f.status === "missing");
  const anyReview = reqFields.some((f) => f.status === "needs_review");
  const allExtracted = reqFields.every((f) => f.status === "extracted");
  const avg = reqFields.reduce((s, f) => s + (f.confidence ?? 0), 0) / reqFields.length;
  const conf = Number(avg.toFixed(3));
  if (anyMissing || anyReview || conf < 0.55) return { truth_state: "needs_review" as const, lane_confidence: conf };
  if (allExtracted && conf >= 0.75) return { truth_state: "extracted" as const, lane_confidence: conf };
  return { truth_state: "proposed" as const, lane_confidence: conf };
}

async function mistralOcr(args: { signedUrl: string; apiKey: string }) {
  const r = await fetch(`${MISTRAL_API}/ocr`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${args.apiKey}` },
    body: JSON.stringify({
      model: OCR_MODEL,
      document: { type: "document_url", document_url: args.signedUrl },
      include_image_base64: false,
    }),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`mistral_ocr_${r.status}:${body.slice(0, 200)}`);
  }
  const json = await r.json();
  const pages = Array.isArray(json?.pages) ? json.pages : [];
  const text = pages.map((p: any) => p?.markdown ?? p?.text ?? "").join("\n\n").trim();
  return { text, pages: pages.length };
}

interface ExtractionResult {
  family: Family;
  family_confidence: number;
  is_recognized: boolean;
  rejection_reason: string | null;
  facts: Record<string, CanonicalField>;
  notes: string[];
}

async function mistralExtract(args: { ocrText: string; declaredFamily: Family; apiKey: string }): Promise<ExtractionResult> {
  const tool = {
    type: "function",
    function: {
      name: "emit_canonical_document",
      description:
        "Emit canonical fields for a recognized identity / education document. " +
        "If NOT a passport, graduation cert, language cert, or transcript — set is_recognized=false. " +
        "NEVER hallucinate fields. Only emit values literally present in OCR text.",
      parameters: {
        type: "object",
        properties: {
          family: {
            type: "string",
            enum: ["passport_id", "graduation_certificate", "language_certificate", "academic_transcript", "unknown_document"],
          },
          family_confidence: { type: "number", minimum: 0, maximum: 1 },
          is_recognized: { type: "boolean" },
          rejection_reason: { type: ["string", "null"] },
          fields: {
            type: "array",
            items: {
              type: "object",
              properties: {
                key: { type: "string" },
                value: { type: ["string", "null"] },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                evidence: { type: ["string", "null"] },
              },
              required: ["key", "value", "confidence"],
              additionalProperties: false,
            },
          },
          notes: { type: "array", items: { type: "string" } },
        },
        required: ["family", "family_confidence", "is_recognized", "fields"],
        additionalProperties: false,
      },
    },
  };

  const sys =
    "You are a strict document analyst. Read ONLY the OCR text provided. " +
    "Do NOT infer missing data. If a field is not visibly present, set value=null with confidence=0. " +
    "If the document is not an identity or education document, set is_recognized=false.";
  const user =
    `Declared file kind hint: ${args.declaredFamily}\n\n` +
    `OCR_TEXT_BEGIN\n${args.ocrText.slice(0, 12000)}\nOCR_TEXT_END\n\n` +
    `Required keys per family:\n` +
    `- passport_id: full_name, passport_number, nationality, date_of_birth, expiry_date, issuing_country, gender, issue_date\n` +
    `- graduation_certificate: full_name, institution_name, qualification, issue_date\n` +
    `- language_certificate: full_name, test_name, overall_score, test_date\n` +
    `- academic_transcript: full_name, institution_name\n` +
    `Emit exactly ONE tool call.`;

  const r = await fetch(`${MISTRAL_API}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${args.apiKey}` },
    body: JSON.stringify({
      model: LLM_MODEL,
      temperature: 0,
      max_tokens: 1800,
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "emit_canonical_document" } },
    }),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`mistral_extract_${r.status}:${body.slice(0, 200)}`);
  }
  const json = await r.json();
  const call = json?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) throw new Error("mistral_extract_no_tool_call");
  let parsed: any;
  try {
    parsed = JSON.parse(call.function.arguments);
  } catch (e) {
    throw new Error("mistral_extract_bad_json:" + (e as Error).message);
  }

  const facts: Record<string, CanonicalField> = {};
  for (const f of parsed.fields ?? []) {
    const conf = Number(f.confidence ?? 0);
    const value = f.value ?? null;
    const status: CanonicalField["status"] =
      value == null ? "missing" : conf >= 0.8 ? "extracted" : conf >= 0.5 ? "proposed" : "needs_review";
    facts[f.key] = { value, confidence: conf, source: "mistral_ocr", status, raw: f.evidence ?? null };
  }
  return {
    family: parsed.family as Family,
    family_confidence: Number(parsed.family_confidence ?? 0),
    is_recognized: !!parsed.is_recognized,
    rejection_reason: parsed.rejection_reason ?? null,
    facts,
    notes: Array.isArray(parsed.notes) ? parsed.notes : [],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const t0 = Date.now();
  const trace_id = req.headers.get("x-portal-trace-id") ?? `pde_${crypto.randomUUID()}`;

  let body: { draft_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonRes({ ok: false, error: "invalid_json", trace_id }, 400);
  }
  if (!body?.draft_id) {
    return jsonRes({ ok: false, error: "missing_draft_id", trace_id }, 400);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");
  if (!MISTRAL_API_KEY) return jsonRes({ ok: false, error: "mistral_key_missing", trace_id }, 500);

  // Authenticate caller
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return jsonRes({ ok: false, error: "unauthorized", trace_id }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: userRes } = await admin.auth.getUser(token);
  const user_id = userRes?.user?.id ?? null;
  if (!user_id) return jsonRes({ ok: false, error: "unauthorized", trace_id }, 401);

  // Load draft and verify ownership
  const { data: draft, error: draftErr } = await admin
    .from("portal_document_drafts")
    .select("id, student_user_id, draft_storage_bucket, draft_storage_path, document_type, status, discarded_at, shared_to_crm_at")
    .eq("id", body.draft_id)
    .single();

  if (draftErr || !draft) {
    tlog(trace_id, "draft_not_found", { draft_id: body.draft_id, err: draftErr?.message });
    return jsonRes({ ok: false, error: "draft_not_found", trace_id }, 404);
  }
  if (draft.student_user_id !== user_id) {
    tlog(trace_id, "ownership_mismatch", { draft_id: body.draft_id });
    return jsonRes({ ok: false, error: "forbidden", trace_id }, 403);
  }
  if (draft.discarded_at || draft.shared_to_crm_at) {
    return jsonRes({ ok: false, error: "draft_inactive", trace_id }, 409);
  }
  if (draft.draft_storage_bucket !== "portal-drafts") {
    return jsonRes({ ok: false, error: "wrong_bucket", trace_id }, 400);
  }

  tlog(trace_id, "extraction_starting", { draft_id: draft.id, path: draft.draft_storage_path });

  // Mark as running
  await admin
    .from("portal_document_drafts")
    .update({
      extraction_status: "extraction_running",
      extraction_started_at: new Date().toISOString(),
      extraction_trace_id: trace_id,
      extraction_error: null,
    })
    .eq("id", draft.id);

  try {
    // Sign URL in portal-drafts bucket
    const { data: signed, error: sErr } = await admin.storage
      .from("portal-drafts")
      .createSignedUrl(draft.draft_storage_path, 600);
    if (sErr || !signed?.signedUrl) {
      throw new Error("sign_url_failed:" + (sErr?.message ?? "unknown"));
    }
    tlog(trace_id, "signed_url_resolved");

    const declaredFamily = familyFromHint(draft.document_type);

    // OCR
    const ocr = await mistralOcr({ signedUrl: signed.signedUrl, apiKey: MISTRAL_API_KEY });
    tlog(trace_id, "ocr_completed", { pages: ocr.pages, chars: ocr.text.length });

    // Extract
    const ext = await mistralExtract({ ocrText: ocr.text, declaredFamily, apiKey: MISTRAL_API_KEY });
    tlog(trace_id, "extraction_done", { family: ext.family, recognized: ext.is_recognized });

    // Aggregate truth_state
    let truth_state: "extracted" | "proposed" | "needs_review";
    let lane_confidence: number;
    if (!ext.is_recognized || ext.family === "unknown_document") {
      truth_state = "needs_review";
      lane_confidence = ext.family_confidence;
    } else {
      const agg = aggregate(ext.facts, requiredFieldsFor(ext.family));
      truth_state = agg.truth_state;
      lane_confidence = agg.lane_confidence;
    }

    const engine_metadata = {
      producer: PIPELINE_VERSION,
      processing_ms: Date.now() - t0,
      ocr_used: true,
      schema_version: "v1",
      ocr_pages: ocr.pages,
      ocr_chars: ocr.text.length,
      family_detected: ext.family,
      family_confidence: ext.family_confidence,
      notes: ext.notes,
    };

    // Upsert extraction row (one per draft)
    const { error: upsertErr } = await admin
      .from("portal_document_draft_extractions")
      .upsert(
        {
          draft_id: draft.id,
          student_user_id: draft.student_user_id,
          family: ext.family,
          family_confidence: ext.family_confidence,
          is_recognized: ext.is_recognized,
          rejection_reason: ext.rejection_reason,
          truth_state,
          lane_confidence,
          facts: ext.facts as unknown as Record<string, unknown>,
          ocr_pages: ocr.pages,
          ocr_chars: ocr.text.length,
          engine_metadata,
          trace_id,
        },
        { onConflict: "draft_id" },
      );

    if (upsertErr) {
      throw new Error("extraction_upsert_failed:" + upsertErr.message);
    }

    await admin
      .from("portal_document_drafts")
      .update({
        extraction_status: "extraction_completed",
        extraction_completed_at: new Date().toISOString(),
        extraction_error: null,
      })
      .eq("id", draft.id);

    tlog(trace_id, "extraction_persisted", { draft_id: draft.id, truth_state });

    return jsonRes({
      ok: true,
      draft_id: draft.id,
      extraction_status: "extraction_completed",
      family: ext.family,
      is_recognized: ext.is_recognized,
      truth_state,
      lane_confidence,
      trace_id,
    });
  } catch (e) {
    const errMsg = (e as Error).message ?? "unknown_error";
    tlog(trace_id, "extraction_failed", { error: errMsg });
    await admin
      .from("portal_document_drafts")
      .update({
        extraction_status: "extraction_failed",
        extraction_error: errMsg.slice(0, 500),
        extraction_completed_at: new Date().toISOString(),
      })
      .eq("id", draft.id);
    return jsonRes({ ok: false, error: errMsg, trace_id }, 500);
  }
});
