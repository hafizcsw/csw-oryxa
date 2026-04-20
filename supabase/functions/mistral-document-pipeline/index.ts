// ═══════════════════════════════════════════════════════════════
// mistral-document-pipeline — UNIFIED file engine (Mistral-only)
// ═══════════════════════════════════════════════════════════════
// One pipeline. No fallbacks. No legacy engines.
//
// Flow:
//   1. Receive { document_id, bucket, path, file_kind }
//   2. Create short-lived signed URL for the storage object
//   3. Mistral OCR  (mistral-ocr-latest) → text + page layout
//   4. Mistral LLM  (mistral-small-latest) with tool-calling →
//      family-specific canonical fields with confidence
//   5. Write truth row to `document_lane_facts`
//   6. If requires_review → upsert into `document_review_queue`
//
// Truthful by construction:
//   • Negative / unrelated files → truth_state='needs_review',
//     review_reason='document_unrecognized'.
//   • Mistral failure → truth_state='needs_review',
//     review_reason='mistral_pipeline_error'.
//   • NEVER fabricates fields. Every fact carries source='mistral_ocr'.
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MISTRAL_API = "https://api.mistral.ai/v1";
const OCR_MODEL = "mistral-ocr-latest";
const LLM_MODEL = "mistral-small-latest";
const PIPELINE_VERSION = "mistral-pipeline-v1";

type Family =
  | "passport_id"
  | "graduation_certificate"
  | "language_certificate"
  | "academic_transcript"
  | "unknown_document";

type LaneKind = "passport_lane" | "graduation_lane" | "language_lane";

interface CanonicalField {
  value: string | null;
  confidence: number;
  source: string;
  status: "extracted" | "proposed" | "missing" | "needs_review";
  raw?: string | null;
}

interface PipelineRequest {
  document_id: string;
  bucket: string;
  path: string;
  file_kind: string | null;
  declared_family?: Family | null;
}

// ───────────────────────── helpers ─────────────────────────

function familyFromFileKind(kind: string | null | undefined): Family {
  if (!kind) return "unknown_document";
  const k = kind.toLowerCase();
  if (k.includes("passport")) return "passport_id";
  if (k.includes("graduation") || k.includes("diploma")) return "graduation_certificate";
  if (k.includes("language") || k === "ielts" || k === "toefl") return "language_certificate";
  if (k.includes("transcript")) return "academic_transcript";
  return "unknown_document";
}

function laneForFamily(f: Family): LaneKind | null {
  if (f === "passport_id") return "passport_lane";
  if (f === "graduation_certificate") return "graduation_lane";
  if (f === "language_certificate") return "language_lane";
  return null;
}

function requiredFieldsFor(f: Family): string[] {
  if (f === "passport_id") {
    return [
      "full_name",
      "passport_number",
      "nationality",
      "date_of_birth",
      "expiry_date",
      "issuing_country",
    ];
  }
  if (f === "graduation_certificate") {
    return ["full_name", "institution_name", "qualification", "issue_date"];
  }
  if (f === "language_certificate") {
    return ["full_name", "test_name", "overall_score", "test_date"];
  }
  return [];
}

function aggregate(
  facts: Record<string, CanonicalField>,
  required: string[],
): { truth_state: "extracted" | "proposed" | "needs_review"; lane_confidence: number; requires_review: boolean } {
  const reqFields = required.map((k) => facts[k]).filter(Boolean);
  if (reqFields.length === 0) {
    return { truth_state: "needs_review", lane_confidence: 0, requires_review: true };
  }
  const anyMissing = reqFields.some((f) => f.status === "missing");
  const anyReview = reqFields.some((f) => f.status === "needs_review");
  const allExtracted = reqFields.every((f) => f.status === "extracted");
  const avg = reqFields.reduce((s, f) => s + (f.confidence ?? 0), 0) / reqFields.length;
  const conf = Number(avg.toFixed(3));
  if (anyMissing || anyReview || conf < 0.55) {
    return { truth_state: "needs_review", lane_confidence: conf, requires_review: true };
  }
  if (allExtracted && conf >= 0.75) {
    return { truth_state: "extracted", lane_confidence: conf, requires_review: false };
  }
  return { truth_state: "proposed", lane_confidence: conf, requires_review: conf < 0.7 };
}

// ───────────────────────── Mistral calls ─────────────────────────

async function mistralOcr(args: { signedUrl: string; apiKey: string }): Promise<{
  text: string;
  pages: number;
  raw: unknown;
}> {
  const r = await fetch(`${MISTRAL_API}/ocr`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`,
    },
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
  const text = pages
    .map((p: any) => p?.markdown ?? p?.text ?? "")
    .join("\n\n")
    .trim();
  return { text, pages: pages.length, raw: json };
}

interface ExtractionResult {
  family: Family;
  family_confidence: number;
  is_recognized: boolean;
  rejection_reason: string | null;
  facts: Record<string, CanonicalField>;
  notes: string[];
}

async function mistralExtract(args: {
  ocrText: string;
  declaredFamily: Family;
  apiKey: string;
}): Promise<ExtractionResult> {
  const tool = {
    type: "function",
    function: {
      name: "emit_canonical_document",
      description:
        "Emit canonical fields for a recognized identity / education document. " +
        "If the document is NOT a passport, graduation certificate, language certificate, " +
        "or academic transcript — set is_recognized=false and rejection_reason. " +
        "NEVER hallucinate fields you cannot read directly from the OCR text.",
      parameters: {
        type: "object",
        properties: {
          family: {
            type: "string",
            enum: [
              "passport_id",
              "graduation_certificate",
              "language_certificate",
              "academic_transcript",
              "unknown_document",
            ],
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
    "Do NOT infer missing data. If a required field is not visibly present, set value=null with confidence=0. " +
    "If the document is not an identity or education document, set is_recognized=false.";

  const user =
    `Declared file kind hint: ${args.declaredFamily}\n\n` +
    `OCR_TEXT_BEGIN\n${args.ocrText.slice(0, 12000)}\nOCR_TEXT_END\n\n` +
    `Required keys per family:\n` +
    `- passport_id: full_name, passport_number, nationality, date_of_birth, expiry_date, issuing_country\n` +
    `- graduation_certificate: full_name, institution_name, qualification, issue_date\n` +
    `- language_certificate: full_name, test_name, overall_score, test_date\n` +
    `- academic_transcript: full_name, institution_name (rows handled elsewhere)\n` +
    `Emit exactly ONE tool call.`;

  const r = await fetch(`${MISTRAL_API}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      temperature: 0,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
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
      value == null
        ? "missing"
        : conf >= 0.8
        ? "extracted"
        : conf >= 0.5
        ? "proposed"
        : "needs_review";
    facts[f.key] = {
      value,
      confidence: conf,
      source: "mistral_ocr",
      status,
      raw: f.evidence ?? null,
    };
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

// ───────────────────────── handler ─────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const t0 = Date.now();
  let body: PipelineRequest;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  if (!body?.document_id || !body?.bucket || !body?.path) {
    return json({ ok: false, error: "missing_fields" }, 400);
  }

  const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!MISTRAL_API_KEY) return json({ ok: false, error: "mistral_key_missing" }, 500);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Resolve user from authorization header (RLS-safe write)
  let user_id: string | null = null;
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (token) {
      const { data } = await supabase.auth.getUser(token);
      user_id = data?.user?.id ?? null;
    }
  } catch { /* ignore */ }
  if (!user_id) return json({ ok: false, error: "unauthorized" }, 401);

  const declaredFamily = (body.declared_family ?? familyFromFileKind(body.file_kind)) as Family;

  try {
    // 1. Sign URL (10 min)
    const { data: signed, error: sErr } = await supabase
      .storage
      .from(body.bucket)
      .createSignedUrl(body.path, 600);
    if (sErr || !signed?.signedUrl) {
      throw new Error("sign_url_failed:" + (sErr?.message ?? "unknown"));
    }

    // 2. OCR
    const ocr = await mistralOcr({ signedUrl: signed.signedUrl, apiKey: MISTRAL_API_KEY });

    // 3. Extract
    const ext = await mistralExtract({
      ocrText: ocr.text,
      declaredFamily,
      apiKey: MISTRAL_API_KEY,
    });

    // 4. Decide truth
    const family = ext.family;
    const lane = laneForFamily(family);
    const required = requiredFieldsFor(family);

    let truth_state: "extracted" | "proposed" | "needs_review";
    let lane_confidence: number;
    let requires_review: boolean;
    let review_reason: string | null = null;

    if (!ext.is_recognized || family === "unknown_document" || !lane) {
      truth_state = "needs_review";
      lane_confidence = ext.family_confidence;
      requires_review = true;
      review_reason = ext.rejection_reason ?? "document_unrecognized";
    } else {
      const agg = aggregate(ext.facts, required);
      truth_state = agg.truth_state;
      lane_confidence = agg.lane_confidence;
      requires_review = agg.requires_review;
      if (requires_review) review_reason = "fields_incomplete_or_low_confidence";
    }

    const engine_metadata = {
      producer: PIPELINE_VERSION,
      processing_ms: Date.now() - t0,
      ocr_used: true,
      pdf_text_used: false,
      schema_version: "v1",
      ocr_pages: ocr.pages,
      ocr_chars: ocr.text.length,
      family_detected: family,
      family_confidence: ext.family_confidence,
      review_reason,
    };

    // 5. Persist truth row (always)
    if (lane) {
      const { error: upErr } = await supabase
        .from("document_lane_facts")
        .upsert(
          {
            document_id: body.document_id,
            user_id,
            lane,
            truth_state,
            lane_confidence,
            requires_review,
            facts: ext.facts as unknown as Record<string, unknown>,
            engine_metadata,
            notes: ext.notes,
          },
          { onConflict: "document_id" },
        );
      if (upErr) console.warn("[mistral-pipeline] lane_facts upsert failed", upErr);
    } else {
      // Unrecognized: record as a needs_review row in the queue only.
      const { error: rqErr } = await supabase
        .from("document_review_queue")
        .upsert(
          {
            document_id: body.document_id,
            user_id,
            state: "pending",
            reason: review_reason ?? "document_unrecognized",
            payload: { engine_metadata, notes: ext.notes },
          },
          { onConflict: "document_id" },
        );
      if (rqErr) console.warn("[mistral-pipeline] review_queue upsert failed", rqErr);
    }

    // 6. Mirror to review queue if needed
    if (lane && requires_review) {
      const { error: rqErr } = await supabase
        .from("document_review_queue")
        .upsert(
          {
            document_id: body.document_id,
            user_id,
            state: "pending",
            reason: review_reason ?? "needs_review",
            payload: { facts: ext.facts, engine_metadata },
          },
          { onConflict: "document_id" },
        );
      if (rqErr) console.warn("[mistral-pipeline] review_queue mirror failed", rqErr);
    }

    return json({
      ok: true,
      document_id: body.document_id,
      family,
      lane,
      truth_state,
      lane_confidence,
      requires_review,
      review_reason,
      ocr_pages: ocr.pages,
      processing_ms: Date.now() - t0,
    });
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    console.error("[mistral-pipeline] ERROR", msg);

    // Honest failure: persist needs_review row so the file is not lost.
    try {
      await supabase.from("document_review_queue").upsert(
        {
          document_id: body.document_id,
          user_id,
          state: "pending",
          reason: "mistral_pipeline_error",
          payload: { error: msg, declared_family: declaredFamily },
        },
        { onConflict: "document_id" },
      );
    } catch { /* swallow */ }

    return json(
      {
        ok: false,
        document_id: body.document_id,
        error: "mistral_pipeline_error",
        details: msg,
        processing_ms: Date.now() - t0,
      },
      502,
    );
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
