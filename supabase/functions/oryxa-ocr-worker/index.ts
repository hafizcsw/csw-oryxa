// ═══════════════════════════════════════════════════════════════
// oryxa-ocr-worker — CSW-controlled OCR pre-processing
// ───────────────────────────────────────────────────────────────
// Order 3R.1.
//
// Pipeline per draft:
//   1. Verify caller owns draft_id.
//   2. Mark portal_document_drafts.extraction_status = 'ocr_running'.
//   3. Try PDF text-layer extraction (unpdf, runs in-Deno, no
//      external call). If it yields enough characters → done.
//   4. Otherwise call paddle-structure (our VPS PaddleOCR proxy)
//      for image / scanned / low-text PDFs.
//   5. On OCR success → mark 'ocr_completed', invoke
//      oryxa-ai-provider with task_type=document_extraction and
//      the OCR text (NOT the raw file).
//   6. Persist OCR audit row in oryxa_ocr_runs.
//
// Hard prohibitions enforced:
//   • Never sends the raw file to DeepSeek or any external API.
//   • Never calls Mistral, Google Vision, AWS Textract, OpenAI.
//   • Never writes to CRM tables (customer_files, student-docs,
//     crm_storage, document_lane_facts, document_review_queue).
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-portal-trace-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function tlog(trace_id: string, stage: string, payload: Record<string, unknown> = {}) {
  try {
    console.log(JSON.stringify({ fn: "oryxa-ocr-worker", trace_id, stage, ts: new Date().toISOString(), ...payload }));
  } catch {
    console.log(`[oryxa-ocr-worker] trace=${trace_id} stage=${stage}`);
  }
}

const MIN_PDF_TEXT_CHARS = 120; // below this we treat the PDF as scanned

interface ReqBody {
  draft_id?: string;
  trace_id?: string;
  document_type_hint?: string | null;
  /** if true, skip the DeepSeek call; useful for OCR-only smoke tests */
  skip_extraction?: boolean;
}

interface OcrPage {
  page: number;
  text: string;
  confidence: number | null;
  method: "pdf_text" | "paddle_structure" | "none";
}

interface OcrResult {
  ocr_text: string;
  pages: OcrPage[];
  engine_path: "pdf_text" | "paddle_structure" | "mixed" | "failed";
  quality_flags: string[];
  avg_confidence: number | null;
  status: "ok" | "no_endpoint_configured" | "unreadable_document" | "failed";
  error?: string;
}

// ─── PDF text-layer extraction (in-Deno, no external call) ─────

async function tryPdfTextLayer(bytes: Uint8Array, trace_id: string): Promise<OcrResult> {
  try {
    const pdf = await getDocumentProxy(bytes);
    const { totalPages, text } = await extractText(pdf, { mergePages: false });
    const pages: OcrPage[] = (Array.isArray(text) ? text : [String(text)]).map((t, i) => ({
      page: i + 1,
      text: String(t || ""),
      confidence: null,
      method: "pdf_text",
    }));
    const joined = pages.map((p) => p.text).join("\n\n").trim();
    if (joined.length >= MIN_PDF_TEXT_CHARS) {
      tlog(trace_id, "pdf_text_ok", { pages: totalPages, chars: joined.length });
      return {
        ocr_text: joined,
        pages,
        engine_path: "pdf_text",
        quality_flags: [],
        avg_confidence: null,
        status: "ok",
      };
    }
    tlog(trace_id, "pdf_text_too_short", { chars: joined.length });
    return {
      ocr_text: joined,
      pages,
      engine_path: "failed",
      quality_flags: ["pdf_text_too_short"],
      avg_confidence: null,
      status: "failed",
      error: "pdf_text_layer_insufficient",
    };
  } catch (e) {
    tlog(trace_id, "pdf_text_err", { error: (e as Error).message });
    return {
      ocr_text: "",
      pages: [],
      engine_path: "failed",
      quality_flags: ["pdf_text_failed"],
      avg_confidence: null,
      status: "failed",
      error: "pdf_text_layer_error",
    };
  }
}

// ─── PaddleOCR via our VPS proxy ────────────────────────────────

async function tryPaddleStructure(args: {
  draft_id: string;
  authHeader: string;
  trace_id: string;
  supabaseUrl: string;
  anonKey: string;
}): Promise<OcrResult> {
  const r = await fetch(`${args.supabaseUrl}/functions/v1/paddle-structure`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: args.authHeader,
      apikey: args.anonKey,
      "x-portal-trace-id": args.trace_id,
    },
    body: JSON.stringify({ draft_id: args.draft_id, trace_id: args.trace_id }),
  });
  const text = await r.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    return {
      ocr_text: "",
      pages: [],
      engine_path: "failed",
      quality_flags: ["paddle_bad_json"],
      avg_confidence: null,
      status: "failed",
      error: "paddle_bad_json",
    };
  }

  if (!body?.ok) {
    const reason = body?.reason ?? "paddle_error";
    const status: OcrResult["status"] =
      reason === "no_endpoint_configured" ? "no_endpoint_configured" : "failed";
    return {
      ocr_text: "",
      pages: [],
      engine_path: "failed",
      quality_flags: [reason],
      avg_confidence: null,
      status,
      error: reason,
    };
  }

  const upstreamPages: any[] = Array.isArray(body.pages) ? body.pages : [];
  const pages: OcrPage[] = upstreamPages.map((p, i) => ({
    page: typeof p?.page_number === "number" ? p.page_number : i + 1,
    text: typeof p?.text === "string" ? p.text : "",
    confidence: typeof p?.quality_score === "number" ? p.quality_score : null,
    method: "paddle_structure",
  }));
  const joined = pages.map((p) => p.text).join("\n\n").trim();
  const confs = pages.map((p) => p.confidence).filter((c): c is number => typeof c === "number");
  const avg = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : null;

  if (!joined) {
    return {
      ocr_text: "",
      pages,
      engine_path: "failed",
      quality_flags: ["paddle_empty_text"],
      avg_confidence: avg,
      status: "unreadable_document",
      error: "paddle_returned_empty_text",
    };
  }

  return {
    ocr_text: joined,
    pages,
    engine_path: "paddle_structure",
    quality_flags: avg !== null && avg < 0.5 ? ["low_ocr_confidence"] : [],
    avg_confidence: avg,
    status: "ok",
  };
}

// ─── Main handler ───────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonRes({ ok: false, reason: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) {
    return jsonRes({ ok: false, reason: "supabase_env_missing" }, 500);
  }

  let body: ReqBody;
  try {
    body = await req.json();
  } catch {
    return jsonRes({ ok: false, reason: "bad_json" }, 400);
  }

  const trace_id = body.trace_id || crypto.randomUUID();
  if (!body.draft_id) return jsonRes({ ok: false, reason: "draft_id_required", trace_id }, 400);

  // Caller JWT
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return jsonRes({ ok: false, reason: "no_auth", trace_id }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonRes({ ok: false, reason: "auth_invalid", trace_id }, 401);
  }
  const user_id = userData.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Ownership + draft fetch
  const { data: draft, error: dErr } = await admin
    .from("portal_document_drafts")
    .select("id,student_user_id,draft_storage_bucket,draft_storage_path,mime_type,original_file_name,document_type")
    .eq("id", body.draft_id)
    .maybeSingle();
  if (dErr || !draft) return jsonRes({ ok: false, reason: "draft_not_found", trace_id }, 404);
  if (draft.student_user_id !== user_id) return jsonRes({ ok: false, reason: "draft_forbidden", trace_id }, 403);

  const t0 = Date.now();
  const isPdf = (draft.mime_type ?? "").toLowerCase().includes("pdf") ||
    (draft.original_file_name ?? "").toLowerCase().endsWith(".pdf");

  // Mark OCR running
  await admin
    .from("portal_document_drafts")
    .update({
      extraction_status: "ocr_running",
      extraction_started_at: new Date().toISOString(),
      extraction_trace_id: trace_id,
      extraction_error: null,
    })
    .eq("id", draft.id);

  // ── Step 1: PDF text-layer (if PDF) ──
  let ocr: OcrResult = {
    ocr_text: "",
    pages: [],
    engine_path: "failed",
    quality_flags: [],
    avg_confidence: null,
    status: "failed",
  };

  if (isPdf) {
    const dl = await admin.storage
      .from(draft.draft_storage_bucket || "portal-drafts")
      .download(draft.draft_storage_path);
    if (!dl.error && dl.data) {
      const bytes = new Uint8Array(await dl.data.arrayBuffer());
      ocr = await tryPdfTextLayer(bytes, trace_id);
    } else {
      tlog(trace_id, "download_failed", { error: dl.error?.message });
    }
  }

  // ── Step 2: PaddleOCR fallback for images / scanned PDFs ──
  if (ocr.status !== "ok") {
    const prevFlags = ocr.quality_flags;
    const paddle = await tryPaddleStructure({
      draft_id: draft.id,
      authHeader,
      trace_id,
      supabaseUrl: SUPABASE_URL,
      anonKey: ANON_KEY,
    });
    if (paddle.status === "ok" && isPdf) {
      ocr = { ...paddle, engine_path: "mixed", quality_flags: [...prevFlags, ...paddle.quality_flags] };
    } else {
      ocr = paddle;
    }
  }

  const ocr_latency_ms = Date.now() - t0;
  const chars_total = ocr.ocr_text.length;

  // Persist OCR run
  await admin.from("oryxa_ocr_runs").insert({
    student_user_id: user_id,
    draft_id: draft.id,
    engine_path: ocr.engine_path,
    page_methods: ocr.pages.map((p) => p.method),
    pages_total: ocr.pages.length || null,
    chars_total,
    avg_confidence: ocr.avg_confidence,
    quality_flags: ocr.quality_flags,
    status: ocr.status,
    error: ocr.error ?? null,
    latency_ms: ocr_latency_ms,
    trace_id,
  });

  if (ocr.status !== "ok") {
    const ext_error = ocr.status === "no_endpoint_configured"
      ? "ocr_endpoint_not_configured"
      : ocr.status === "unreadable_document"
      ? "unreadable_document"
      : "ocr_failed";
    await admin
      .from("portal_document_drafts")
      .update({
        extraction_status: "extraction_failed",
        extraction_completed_at: new Date().toISOString(),
        extraction_error: ext_error,
      })
      .eq("id", draft.id);
    return jsonRes({
      ok: false,
      stage: "ocr",
      reason: ext_error,
      trace_id,
      engine_path: ocr.engine_path,
      quality_flags: ocr.quality_flags,
    });
  }

  // Mark OCR completed
  await admin
    .from("portal_document_drafts")
    .update({ extraction_status: "ocr_completed" })
    .eq("id", draft.id);

  if (body.skip_extraction) {
    return jsonRes({
      ok: true,
      stage: "ocr_only",
      trace_id,
      draft_id: draft.id,
      ocr_text_chars: chars_total,
      pages: ocr.pages.length,
      engine_path: ocr.engine_path,
      quality_flags: ocr.quality_flags,
    });
  }

  // ── Step 3: hand off OCR text (NOT the raw file) to DeepSeek ──
  await admin
    .from("portal_document_drafts")
    .update({ extraction_status: "deepseek_extraction_running" })
    .eq("id", draft.id);

  const dsResp = await fetch(`${SUPABASE_URL}/functions/v1/oryxa-ai-provider`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
      apikey: ANON_KEY,
      "x-portal-trace-id": trace_id,
    },
    body: JSON.stringify({
      task_type: "document_extraction",
      ocr_text: ocr.ocr_text,
      document_type_hint: body.document_type_hint ?? draft.document_type ?? null,
      draft_id: draft.id,
      trace_id,
    }),
  });
  const dsText = await dsResp.text();
  let dsBody: any;
  try { dsBody = JSON.parse(dsText); } catch { dsBody = { ok: false, error: "deepseek_envelope_bad" }; }

  if (!dsResp.ok || !dsBody?.ok) {
    await admin
      .from("portal_document_drafts")
      .update({
        extraction_status: "extraction_failed",
        extraction_completed_at: new Date().toISOString(),
        extraction_error: "deepseek_provider_error",
      })
      .eq("id", draft.id);
    return jsonRes({
      ok: false,
      stage: "deepseek",
      reason: dsBody?.error ?? "deepseek_provider_error",
      trace_id,
      engine_path: ocr.engine_path,
    });
  }

  // Decorate the extraction row with which OCR engine fed it
  await admin
    .from("portal_document_draft_extractions")
    .update({
      ocr_engine_path: ocr.engine_path,
      ocr_quality_flags: ocr.quality_flags,
      ocr_pages: ocr.pages.length,
      ocr_chars: chars_total,
    })
    .eq("draft_id", draft.id);

  return jsonRes({
    ok: true,
    stage: "extraction_completed",
    trace_id,
    draft_id: draft.id,
    engine_path: ocr.engine_path,
    quality_flags: ocr.quality_flags,
    deepseek: {
      provider: dsBody.provider,
      model: dsBody.model,
      persisted_to_draft: dsBody.persisted_to_draft,
    },
  });
});
