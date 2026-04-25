// ═══════════════════════════════════════════════════════════════
// deepseek-ocr-service — CSW-controlled DeepSeek-OCR adapter
// ───────────────────────────────────────────────────────────────
// Order 3R.1 (architectural update).
//
// Role
//   Primary OCR engine for scanned PDFs / images / passports /
//   certificates / IELTS / transcripts. Called by oryxa-ocr-worker
//   when the in-Deno PDF text-layer path (unpdf) does NOT yield
//   enough characters, or the file is an image.
//
// Contract
//   Edge function caller sends:
//     { draft_id, document_type_hint, trace_id }
//   This adapter:
//     1. Verifies caller JWT and ownership of draft_id.
//     2. Creates a short-lived signed URL on portal-drafts.
//     3. POSTs to a CSW-controlled DeepSeek-OCR HTTP service:
//          DEEPSEEK_OCR_ENDPOINT
//          DEEPSEEK_OCR_API_KEY  (Bearer)
//        with body:
//          { signed_url, mime_type, file_name,
//            document_type_hint, trace_id }
//     4. Normalises the response into:
//          { ok, engine, ocr_text, markdown, pages[], quality_flags,
//            trace_id }
//        or { ok:false, reason, trace_id }.
//
// Privacy wording (enforced by behaviour, not strings)
//   Raw student files are NOT sent to the DeepSeek V4 API or to
//   any third-party OCR/AI API. For OCR the raw file may be
//   fetched only by a CSW-controlled DeepSeek-OCR service via a
//   short-lived signed URL on our own storage bucket.
//
// Hard prohibitions
//   • No CRM mutation (customer_files, student-docs, crm_storage,
//     document_lane_facts, document_review_queue).
//   • No Mistral / Google Vision / AWS Textract / OpenAI raw doc.
//   • No call to DeepSeek V4 API from here. That happens later in
//     oryxa-ai-provider, with OCR text only.
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
      fn: "deepseek-ocr-service",
      trace_id,
      stage,
      ts: new Date().toISOString(),
      ...payload,
    }));
  } catch {
    console.log(`[deepseek-ocr-service] trace=${trace_id} stage=${stage}`);
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
  method: "deepseek_ocr_2";
}

interface NormalizedResult {
  ok: boolean;
  engine: "deepseek_ocr_2";
  ocr_text: string;
  markdown: string;
  pages: NormalizedPage[];
  quality_flags: string[];
  trace_id: string;
  reason?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonRes({ ok: false, reason: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const ENDPOINT = Deno.env.get("DEEPSEEK_OCR_ENDPOINT");
  const API_KEY = Deno.env.get("DEEPSEEK_OCR_API_KEY");

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

  // Service configured?
  if (!ENDPOINT || !API_KEY) {
    tlog(trace_id, "service_not_configured", {
      has_endpoint: !!ENDPOINT,
      has_api_key: !!API_KEY,
    });
    return jsonRes({ ok: false, reason: "deepseek_ocr_service_not_configured", trace_id });
  }

  // Short-lived signed URL on OUR storage
  const ttl = Math.max(15, Math.min(180, body.url_ttl_seconds ?? 90));
  const { data: signed, error: sErr } = await admin
    .storage
    .from(draft.draft_storage_bucket || "portal-drafts")
    .createSignedUrl(draft.draft_storage_path, ttl);
  if (sErr || !signed?.signedUrl) {
    tlog(trace_id, "sign_failed", { error: sErr?.message });
    return jsonRes({ ok: false, reason: "sign_failed", trace_id }, 500);
  }

  const document_type_hint = body.document_type_hint
    ?? draft.document_type
    ?? "unknown";

  // Call CSW-controlled DeepSeek-OCR service
  const t0 = Date.now();
  let upstream: Response;
  try {
    const ctl = new AbortController();
    const tmr = setTimeout(() => ctl.abort(), 60_000);
    upstream = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        signed_url: signed.signedUrl,
        mime_type: draft.mime_type ?? "application/octet-stream",
        file_name: draft.original_file_name,
        document_type_hint,
        trace_id,
      }),
      signal: ctl.signal,
    });
    clearTimeout(tmr);
  } catch (e) {
    tlog(trace_id, "upstream_unreachable", { error: (e as Error).message });
    return jsonRes({ ok: false, reason: "deepseek_ocr_failed", detail: "service_unreachable", trace_id });
  }

  const raw = await upstream.text();
  if (!upstream.ok) {
    tlog(trace_id, "upstream_error", { status: upstream.status, body: raw.slice(0, 240) });
    return jsonRes({
      ok: false,
      reason: "deepseek_ocr_failed",
      http_status: upstream.status,
      trace_id,
    });
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return jsonRes({ ok: false, reason: "deepseek_ocr_failed", detail: "bad_json", trace_id });
  }

  // Accept either our normalized contract or a raw service shape.
  const upstreamPages: any[] = Array.isArray(payload?.pages) ? payload.pages : [];
  const pages: NormalizedPage[] = upstreamPages.map((p, i) => {
    const text = typeof p?.text === "string" ? p.text : "";
    const markdown = typeof p?.markdown === "string" ? p.markdown : text;
    const confidence = typeof p?.confidence === "number" ? p.confidence : null;
    const page = typeof p?.page === "number" ? p.page : i + 1;
    return { page, text, markdown, confidence, method: "deepseek_ocr_2" };
  });

  const ocr_text = typeof payload?.ocr_text === "string" && payload.ocr_text.length > 0
    ? payload.ocr_text
    : pages.map((p) => p.text).join("\n\n").trim();
  const markdown = typeof payload?.markdown === "string" && payload.markdown.length > 0
    ? payload.markdown
    : pages.map((p) => p.markdown).join("\n\n").trim();

  if (!ocr_text) {
    tlog(trace_id, "empty_text", { ms: Date.now() - t0 });
    return jsonRes({ ok: false, reason: "deepseek_ocr_failed", detail: "empty_text", trace_id });
  }

  const quality_flags: string[] = Array.isArray(payload?.quality_flags) ? payload.quality_flags : [];

  const result: NormalizedResult = {
    ok: true,
    engine: "deepseek_ocr_2",
    ocr_text,
    markdown,
    pages,
    quality_flags,
    trace_id,
  };

  tlog(trace_id, "ok", { pages: pages.length, chars: ocr_text.length, ms: Date.now() - t0 });
  return jsonRes(result);
});
