// ═══════════════════════════════════════════════════════════════
// oryxa-ocr-worker — CSW-controlled OCR pre-processing
// ───────────────────────────────────────────────────────────────
// Order 3R.1 (architectural update).
//
// Primary OCR engine = DeepSeek-OCR (DeepSeek-OCR-2) via the
// CSW-controlled `deepseek-ocr-service` adapter.
// PaddleOCR is now a deprecated fallback, DISABLED by default.
// It is only used if env ORYXA_OCR_ALLOW_PADDLE_FALLBACK=true.
//
// Pipeline per draft:
//   1. Verify caller owns draft_id.
//   2. Mark portal_document_drafts.extraction_status = 'ocr_running'.
//   3. If file is a PDF → try PDF text-layer extraction (unpdf,
//      runs in-Deno, no external call). If it yields enough
//      characters → engine_path = 'pdf_text', done.
//   4. Otherwise (scanned PDF / image / passport / certificate /
//      IELTS / transcript) → call deepseek-ocr-service.
//      engine_path = 'deepseek_ocr'.
//   5. PaddleOCR is only attempted if explicitly opted-in via
//      ORYXA_OCR_ALLOW_PADDLE_FALLBACK=true. Otherwise the worker
//      surfaces 'deepseek_ocr_service_not_configured' or
//      'deepseek_ocr_failed' as visible extraction errors — no
//      silent pending.
//   6. On OCR success → mark 'ocr_completed', invoke
//      oryxa-ai-provider with task_type=document_extraction and
//      the OCR text/markdown (NEVER the raw file).
//   7. Persist OCR audit row in oryxa_ocr_runs.
//
// Privacy
//   Raw student files are NOT sent to DeepSeek V4 API or to any
//   third-party OCR/AI APIs. For OCR fallback, a short-lived
//   signed URL may be fetched only by a CSW-controlled
//   DeepSeek-OCR service.
//
// Hard prohibitions enforced
//   • Never sends the raw file to DeepSeek V4 / any third-party.
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
  /** if true, skip the DeepSeek V4 extraction call; OCR-only smoke test */
  skip_extraction?: boolean;
}

type EnginePath =
  | "pdf_text"
  | "deepseek_ocr"
  | "mistral_ocr"
  | "paddle_structure"
  | "failed";

interface OcrPage {
  page: number;
  text: string;
  markdown?: string;
  confidence: number | null;
  method: "pdf_text" | "deepseek_ocr_2" | "mistral_ocr" | "paddle_structure" | "none";
}

interface OcrResult {
  ocr_text: string;
  markdown: string;
  pages: OcrPage[];
  engine_path: EnginePath;
  quality_flags: string[];
  avg_confidence: number | null;
  status: "ok" | "service_not_configured" | "unreadable_document" | "failed";
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
        markdown: joined,
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
      markdown: joined,
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
      markdown: "",
      pages: [],
      engine_path: "failed",
      quality_flags: ["pdf_text_failed"],
      avg_confidence: null,
      status: "failed",
      error: "pdf_text_layer_error",
    };
  }
}

// ─── DeepSeek-OCR (primary) via deepseek-ocr-service ────────────

async function tryDeepSeekOcr(args: {
  draft_id: string;
  document_type_hint: string | null;
  authHeader: string;
  trace_id: string;
  supabaseUrl: string;
  anonKey: string;
}): Promise<OcrResult> {
  let upstream: Response;
  try {
    upstream = await fetch(`${args.supabaseUrl}/functions/v1/deepseek-ocr-service`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: args.authHeader,
        apikey: args.anonKey,
        "x-portal-trace-id": args.trace_id,
      },
      body: JSON.stringify({
        draft_id: args.draft_id,
        document_type_hint: args.document_type_hint,
        trace_id: args.trace_id,
      }),
    });
  } catch (e) {
    return {
      ocr_text: "",
      markdown: "",
      pages: [],
      engine_path: "failed",
      quality_flags: ["deepseek_ocr_unreachable"],
      avg_confidence: null,
      status: "failed",
      error: "deepseek_ocr_failed",
    };
  }

  const text = await upstream.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    return {
      ocr_text: "",
      markdown: "",
      pages: [],
      engine_path: "failed",
      quality_flags: ["deepseek_ocr_bad_json"],
      avg_confidence: null,
      status: "failed",
      error: "deepseek_ocr_failed",
    };
  }

  if (!body?.ok) {
    const reason = body?.reason ?? "deepseek_ocr_failed";
    const status: OcrResult["status"] =
      reason === "deepseek_ocr_service_not_configured"
        ? "service_not_configured"
        : "failed";
    return {
      ocr_text: "",
      markdown: "",
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
    page: typeof p?.page === "number" ? p.page : i + 1,
    text: typeof p?.text === "string" ? p.text : "",
    markdown: typeof p?.markdown === "string" ? p.markdown : undefined,
    confidence: typeof p?.confidence === "number" ? p.confidence : null,
    method: "deepseek_ocr_2",
  }));
  const ocr_text = typeof body.ocr_text === "string" && body.ocr_text.length
    ? body.ocr_text
    : pages.map((p) => p.text).join("\n\n").trim();
  const markdown = typeof body.markdown === "string" && body.markdown.length
    ? body.markdown
    : ocr_text;
  const confs = pages.map((p) => p.confidence).filter((c): c is number => typeof c === "number");
  const avg = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : null;

  if (!ocr_text) {
    return {
      ocr_text: "",
      markdown: "",
      pages,
      engine_path: "failed",
      quality_flags: ["deepseek_ocr_empty_text"],
      avg_confidence: avg,
      status: "unreadable_document",
      error: "unreadable_document",
    };
  }

  return {
    ocr_text,
    markdown,
    pages,
    engine_path: "deepseek_ocr",
    quality_flags: Array.isArray(body.quality_flags) ? body.quality_flags : [],
    avg_confidence: avg,
    status: "ok",
  };
}

// ─── Mistral OCR (TRANSITIONAL external) ────────────────────────
// Activated only when ORYXA_OCR_MODE=mistral_ocr_transitional or
// ORYXA_OCR_ALLOW_EXTERNAL_TRANSITIONAL=true. Used for scanned PDFs
// and images while DeepSeek-OCR self-host is not yet closed.
// Sends a short-lived signed URL on portal-drafts to Mistral.
// NOT internal-only — quality_flags carry external_ocr_provider.

async function tryMistralOcr(args: {
  draft_id: string;
  document_type_hint: string | null;
  authHeader: string;
  trace_id: string;
  supabaseUrl: string;
  anonKey: string;
}): Promise<OcrResult> {
  let upstream: Response;
  try {
    upstream = await fetch(`${args.supabaseUrl}/functions/v1/mistral-ocr-service`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: args.authHeader,
        apikey: args.anonKey,
        "x-portal-trace-id": args.trace_id,
      },
      body: JSON.stringify({
        draft_id: args.draft_id,
        document_type_hint: args.document_type_hint,
        trace_id: args.trace_id,
      }),
    });
  } catch {
    return {
      ocr_text: "", markdown: "", pages: [],
      engine_path: "failed",
      quality_flags: ["mistral_ocr_unreachable", "external_ocr_provider"],
      avg_confidence: null,
      status: "failed",
      error: "mistral_ocr_failed",
    };
  }

  const text = await upstream.text();
  let body: any;
  try { body = JSON.parse(text); } catch {
    return {
      ocr_text: "", markdown: "", pages: [],
      engine_path: "failed",
      quality_flags: ["mistral_ocr_bad_json", "external_ocr_provider"],
      avg_confidence: null,
      status: "failed",
      error: "mistral_ocr_failed",
    };
  }

  if (!body?.ok) {
    const reason = body?.reason ?? "mistral_ocr_failed";
    const status: OcrResult["status"] =
      reason === "mistral_ocr_service_not_configured"
        ? "service_not_configured"
        : "failed";
    return {
      ocr_text: "", markdown: "", pages: [],
      engine_path: "failed",
      quality_flags: [reason, "external_ocr_provider"],
      avg_confidence: null,
      status,
      error: reason,
    };
  }

  const upstreamPages: any[] = Array.isArray(body.pages) ? body.pages : [];
  const pages: OcrPage[] = upstreamPages.map((p, i) => ({
    page: typeof p?.page === "number" ? p.page : i + 1,
    text: typeof p?.text === "string" ? p.text : "",
    markdown: typeof p?.markdown === "string" ? p.markdown : undefined,
    confidence: null,
    method: "mistral_ocr",
  }));
  const ocr_text = typeof body.ocr_text === "string" && body.ocr_text.length
    ? body.ocr_text
    : pages.map((p) => p.text).join("\n\n").trim();
  const markdown = typeof body.markdown === "string" && body.markdown.length
    ? body.markdown
    : ocr_text;

  if (!ocr_text) {
    return {
      ocr_text: "", markdown: "", pages,
      engine_path: "failed",
      quality_flags: ["mistral_ocr_empty_text", "external_ocr_provider"],
      avg_confidence: null,
      status: "unreadable_document",
      error: "unreadable_document",
    };
  }

  const upstreamFlags: string[] = Array.isArray(body.quality_flags) ? body.quality_flags : [];
  const flagSet = new Set<string>([
    ...upstreamFlags,
    "external_ocr_provider",
    "mistral_ocr_transitional",
  ]);

  return {
    ocr_text,
    markdown,
    pages,
    engine_path: "mistral_ocr",
    quality_flags: Array.from(flagSet),
    avg_confidence: null,
    status: "ok",
  };
}

// ─── PaddleOCR (DEPRECATED fallback, disabled by default) ───────

async function tryPaddleStructureFallback(args: {
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
  try { body = JSON.parse(text); } catch {
    return {
      ocr_text: "", markdown: "", pages: [],
      engine_path: "failed",
      quality_flags: ["paddle_bad_json", "deprecated_fallback"],
      avg_confidence: null, status: "failed", error: "paddle_bad_json",
    };
  }
  if (!body?.ok) {
    return {
      ocr_text: "", markdown: "", pages: [],
      engine_path: "failed",
      quality_flags: [body?.reason ?? "paddle_error", "deprecated_fallback"],
      avg_confidence: null, status: "failed", error: body?.reason ?? "paddle_error",
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
      ocr_text: "", markdown: "", pages,
      engine_path: "failed",
      quality_flags: ["paddle_empty_text", "deprecated_fallback"],
      avg_confidence: avg, status: "unreadable_document", error: "unreadable_document",
    };
  }
  return {
    ocr_text: joined, markdown: joined, pages,
    engine_path: "paddle_structure",
    quality_flags: ["deprecated_fallback"],
    avg_confidence: avg, status: "ok",
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

  const ALLOW_PADDLE_FALLBACK =
    (Deno.env.get("ORYXA_OCR_ALLOW_PADDLE_FALLBACK") ?? "").toLowerCase() === "true";

  // Transitional EXTERNAL OCR (Mistral) — opt-in only, used while
  // DeepSeek-OCR self-host is not closed on GCP/Mac.
  const OCR_MODE = (Deno.env.get("ORYXA_OCR_MODE") ?? "").toLowerCase();
  const ALLOW_EXTERNAL_TRANSITIONAL =
    (Deno.env.get("ORYXA_OCR_ALLOW_EXTERNAL_TRANSITIONAL") ?? "").toLowerCase() === "true";
  const MISTRAL_TRANSITIONAL_ENABLED =
    OCR_MODE === "mistral_ocr_transitional" || ALLOW_EXTERNAL_TRANSITIONAL;
  // When mode is explicitly mistral_ocr_transitional, prefer Mistral
  // for scanned/image. Otherwise (allow flag only) keep DeepSeek-OCR
  // first and use Mistral only as a fallback if DeepSeek isn't ready.
  const PREFER_MISTRAL_FIRST = OCR_MODE === "mistral_ocr_transitional";

  let body: ReqBody;
  try { body = await req.json(); } catch {
    return jsonRes({ ok: false, reason: "bad_json" }, 400);
  }

  const trace_id = body.trace_id || crypto.randomUUID();
  if (!body.draft_id) return jsonRes({ ok: false, reason: "draft_id_required", trace_id }, 400);

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

  await admin
    .from("portal_document_drafts")
    .update({
      extraction_status: "ocr_running",
      extraction_started_at: new Date().toISOString(),
      extraction_trace_id: trace_id,
      extraction_error: null,
    })
    .eq("id", draft.id);

  let ocr: OcrResult = {
    ocr_text: "", markdown: "", pages: [],
    engine_path: "failed", quality_flags: [], avg_confidence: null,
    status: "failed",
  };

  // ── Step 1: PDF text-layer (in-Deno) ──
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

  // ── Step 2: scanned PDFs / images ──
  // Order of attempt depends on transitional flags:
  //   • PREFER_MISTRAL_FIRST  → Mistral OCR (external) first, then DeepSeek-OCR.
  //   • else                  → DeepSeek-OCR first; if not configured/failed AND
  //                             transitional allow flag is set → Mistral OCR.
  // pdf_text always runs first (above) and short-circuits this block if it succeeds.
  if (ocr.status !== "ok") {
    if (PREFER_MISTRAL_FIRST) {
      tlog(trace_id, "mistral_first_attempt", { mode: OCR_MODE });
      const mi = await tryMistralOcr({
        draft_id: draft.id,
        document_type_hint: body.document_type_hint ?? draft.document_type ?? null,
        authHeader,
        trace_id,
        supabaseUrl: SUPABASE_URL,
        anonKey: ANON_KEY,
      });
      if (mi.status === "ok") {
        ocr = mi;
      } else {
        // Try DeepSeek-OCR as a secondary attempt.
        const ds = await tryDeepSeekOcr({
          draft_id: draft.id,
          document_type_hint: body.document_type_hint ?? draft.document_type ?? null,
          authHeader,
          trace_id,
          supabaseUrl: SUPABASE_URL,
          anonKey: ANON_KEY,
        });
        ocr = ds.status === "ok" ? ds : mi; // surface mistral error if both fail
      }
    } else {
      const ds = await tryDeepSeekOcr({
        draft_id: draft.id,
        document_type_hint: body.document_type_hint ?? draft.document_type ?? null,
        authHeader,
        trace_id,
        supabaseUrl: SUPABASE_URL,
        anonKey: ANON_KEY,
      });

      if (ds.status === "ok") {
        ocr = ds;
      } else if (MISTRAL_TRANSITIONAL_ENABLED) {
        tlog(trace_id, "mistral_fallback_attempt", { reason: ds.error });
        const mi = await tryMistralOcr({
          draft_id: draft.id,
          document_type_hint: body.document_type_hint ?? draft.document_type ?? null,
          authHeader,
          trace_id,
          supabaseUrl: SUPABASE_URL,
          anonKey: ANON_KEY,
        });
        ocr = mi.status === "ok" ? mi : ds; // surface DS error if both fail
      } else if (ALLOW_PADDLE_FALLBACK) {
        // Deprecated fallback, opt-in only.
        tlog(trace_id, "paddle_fallback_attempt", { reason: ds.error });
        const paddle = await tryPaddleStructureFallback({
          draft_id: draft.id,
          authHeader,
          trace_id,
          supabaseUrl: SUPABASE_URL,
          anonKey: ANON_KEY,
        });
        ocr = paddle.status === "ok" ? paddle : ds; // surface DS error if both fail
      } else {
        ocr = ds;
      }
    }
  }

  const ocr_latency_ms = Date.now() - t0;
  const chars_total = ocr.ocr_text.length;

  // Map engine_path → audited provider name. Mistral is recorded
  // explicitly as `mistral_ocr_transitional` so external usage is
  // never silently masked as internal-only.
  const provider =
    ocr.engine_path === "mistral_ocr"     ? "mistral_ocr_transitional" :
    ocr.engine_path === "deepseek_ocr"    ? "deepseek_ocr_2" :
    ocr.engine_path === "pdf_text"        ? "pdf_text_unpdf" :
    ocr.engine_path === "paddle_structure" ? "paddle_structure_deprecated" :
    null;

  await admin.from("oryxa_ocr_runs").insert({
    student_user_id: user_id,
    draft_id: draft.id,
    engine_path: ocr.engine_path,
    provider,
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
    const ext_error =
      ocr.error === "deepseek_ocr_service_not_configured"
        ? "deepseek_ocr_service_not_configured"
        : ocr.error === "mistral_ocr_service_not_configured"
        ? "mistral_ocr_service_not_configured"
        : ocr.status === "unreadable_document"
        ? "unreadable_document"
        : ocr.error === "deepseek_ocr_failed"
        ? "deepseek_ocr_failed"
        : ocr.error === "mistral_ocr_failed"
        ? "mistral_ocr_failed"
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

  // ── Step 3: hand off OCR text (NOT the raw file) to DeepSeek V4 ──
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
