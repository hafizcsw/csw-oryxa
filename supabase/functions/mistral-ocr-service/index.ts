// ═══════════════════════════════════════════════════════════════
// mistral-ocr-service — Transitional EXTERNAL OCR adapter
// ───────────────────────────────────────────────────────────────
// Purpose
//   Transitional fallback OCR for images and SCANNED PDFs only,
//   while DeepSeek-OCR self-host (NVIDIA GPU) is not yet closed
//   on GCP/Mac (DS-OCR-2). NOT a permanent replacement.
//
// Activation (transitional, opt-in)
//   This adapter only does work when invoked by oryxa-ocr-worker
//   under one of:
//     ORYXA_OCR_MODE=mistral_ocr_transitional
//     ORYXA_OCR_ALLOW_EXTERNAL_TRANSITIONAL=true
//   The mode/allow flag is enforced in oryxa-ocr-worker; this
//   service additionally refuses if invoked with no MISTRAL_API_KEY.
//
// Path
//   text-PDF  → handled BEFORE this service (pdf_text via unpdf).
//   scanned/image → this service (Mistral OCR, model=mistral-ocr-latest).
//
// Privacy / boundaries (enforced by behaviour)
//   • A short-lived signed URL on portal-drafts is sent to Mistral.
//     Raw bytes leave Supabase storage to an EXTERNAL provider.
//     We MUST NOT call this "internal-only".
//   • DeepSeek V4 still receives OCR text/markdown only — never raw.
//   • No CRM mutation. No customer_files / student-docs /
//     document_lane_facts / document_review_queue write.
//
// Output (normalized)
//   { ok:true,
//     engine: "mistral_ocr",
//     ocr_text, markdown,
//     pages: [{ page, text, markdown, confidence:null, method:"mistral_ocr" }],
//     quality_flags: ["external_ocr_provider","mistral_ocr_transitional", ...],
//     trace_id }
//   Failure: { ok:false, reason:"mistral_ocr_failed", trace_id, ...detail }
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
    console.log(JSON.stringify({
      fn: "mistral-ocr-service",
      trace_id,
      stage,
      ts: new Date().toISOString(),
      ...payload,
    }));
  } catch {
    console.log(`[mistral-ocr-service] trace=${trace_id} stage=${stage}`);
  }
}

interface ReqBody {
  draft_id?: string;
  trace_id?: string;
  document_type_hint?: string | null;
  url_ttl_seconds?: number;
}

interface NormalizedPage {
  page: number;
  text: string;
  markdown: string;
  confidence: number | null;
  method: "mistral_ocr";
}

interface NormalizedResult {
  ok: true;
  engine: "mistral_ocr";
  ocr_text: string;
  markdown: string;
  pages: NormalizedPage[];
  quality_flags: string[];
  trace_id: string;
}

const MISTRAL_OCR_URL = "https://api.mistral.ai/v1/ocr";
const MISTRAL_OCR_MODEL = "mistral-ocr-latest";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonRes({ ok: false, reason: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");

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
  if (!body.draft_id) {
    return jsonRes({ ok: false, reason: "draft_id_required", trace_id }, 400);
  }

  // Caller JWT (forwarded from oryxa-ocr-worker)
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return jsonRes({ ok: false, reason: "no_auth", trace_id }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    tlog(trace_id, "auth_failed", { error: userErr?.message });
    return jsonRes({ ok: false, reason: "auth_invalid", trace_id }, 401);
  }
  const user_id = userData.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: draft, error: dErr } = await admin
    .from("portal_document_drafts")
    .select("id,student_user_id,draft_storage_bucket,draft_storage_path,mime_type,original_file_name,document_type")
    .eq("id", body.draft_id)
    .maybeSingle();
  if (dErr || !draft) {
    return jsonRes({ ok: false, reason: "draft_not_found", trace_id }, 404);
  }
  if (draft.student_user_id !== user_id) {
    return jsonRes({ ok: false, reason: "draft_forbidden", trace_id }, 403);
  }

  if (!MISTRAL_API_KEY) {
    tlog(trace_id, "service_not_configured", { has_api_key: false });
    return jsonRes({ ok: false, reason: "mistral_ocr_service_not_configured", trace_id });
  }

  // Short-lived signed URL on OUR storage (portal-drafts)
  const ttl = Math.max(15, Math.min(180, body.url_ttl_seconds ?? 90));
  const { data: signed, error: sErr } = await admin
    .storage
    .from(draft.draft_storage_bucket || "portal-drafts")
    .createSignedUrl(draft.draft_storage_path, ttl);
  if (sErr || !signed?.signedUrl) {
    tlog(trace_id, "sign_failed", { error: sErr?.message });
    return jsonRes({ ok: false, reason: "sign_failed", trace_id }, 500);
  }

  const mime = (draft.mime_type ?? "application/octet-stream").toLowerCase();
  const isPdf = mime.includes("pdf") ||
    (draft.original_file_name ?? "").toLowerCase().endsWith(".pdf");

  // Mistral OCR document shape:
  //   { type: "document_url", document_url: "..." }   for PDFs
  //   { type: "image_url",    image_url:    "..." }   for images
  const document = isPdf
    ? { type: "document_url", document_url: signed.signedUrl }
    : { type: "image_url", image_url: signed.signedUrl };

  const t0 = Date.now();
  let upstream: Response;
  try {
    const ctl = new AbortController();
    const tmr = setTimeout(() => ctl.abort(), 60_000);
    upstream = await fetch(MISTRAL_OCR_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: MISTRAL_OCR_MODEL,
        document,
        include_image_base64: false,
      }),
      signal: ctl.signal,
    });
    clearTimeout(tmr);
  } catch (e) {
    tlog(trace_id, "upstream_unreachable", { error: (e as Error).message });
    return jsonRes({ ok: false, reason: "mistral_ocr_failed", detail: "service_unreachable", trace_id });
  }

  const raw = await upstream.text();
  if (!upstream.ok) {
    tlog(trace_id, "upstream_error", { status: upstream.status, body: raw.slice(0, 320) });
    return jsonRes({
      ok: false,
      reason: "mistral_ocr_failed",
      http_status: upstream.status,
      detail: raw.slice(0, 320),
      trace_id,
    });
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return jsonRes({ ok: false, reason: "mistral_ocr_failed", detail: "bad_json", trace_id });
  }

  // Normalize Mistral OCR response → our contract.
  // Mistral returns { pages: [{ index, markdown, ... }], ... }
  const upstreamPages: any[] = Array.isArray(payload?.pages) ? payload.pages : [];
  const pages: NormalizedPage[] = upstreamPages.map((p, i) => {
    const md = typeof p?.markdown === "string" ? p.markdown
             : typeof p?.text === "string" ? p.text
             : "";
    const txt = typeof p?.text === "string" && p.text.length ? p.text : md;
    const pageNum = typeof p?.page === "number" ? p.page
                  : typeof p?.index === "number" ? p.index + 1
                  : i + 1;
    return {
      page: pageNum,
      text: txt,
      markdown: md,
      confidence: null,
      method: "mistral_ocr",
    };
  });

  const ocr_text = pages.map((p) => p.text).join("\n\n").trim();
  const markdown = pages.map((p) => p.markdown).join("\n\n").trim();

  if (!ocr_text) {
    tlog(trace_id, "empty_text", { ms: Date.now() - t0 });
    return jsonRes({ ok: false, reason: "mistral_ocr_failed", detail: "empty_text", trace_id });
  }

  const quality_flags = ["external_ocr_provider", "mistral_ocr_transitional"];

  const result: NormalizedResult = {
    ok: true,
    engine: "mistral_ocr",
    ocr_text,
    markdown,
    pages,
    quality_flags,
    trace_id,
  };

  tlog(trace_id, "ok", {
    pages: pages.length,
    chars: ocr_text.length,
    ms: Date.now() - t0,
    is_pdf: isPdf,
  });
  return jsonRes(result);
});
