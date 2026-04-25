// ═══════════════════════════════════════════════════════════════
// paddle-structure — Edge proxy to CSW-controlled PaddleOCR VPS
// ───────────────────────────────────────────────────────────────
// Order 3R.1 — CSW-controlled OCR pre-processing layer.
//
// Caller : oryxa-ocr-worker (server-to-server, with caller JWT
//          forwarded for ownership check).
// Target : self-hosted paddle-service (PP-StructureV3) at
//          PADDLE_STRUCTURE_ENDPOINT, running on a VPS YOU control.
//
// Flow:
//   1. Verify caller JWT.
//   2. Verify the caller owns draft_id (RLS-style read on
//      portal_document_drafts).
//   3. Create a 60s signed URL on bucket 'portal-drafts'.
//   4. POST { signed_url, mime_type, file_name } to PaddleOCR VPS.
//   5. Return { ok, pages, reading_order, build_time_ms } OR
//      { ok:false, reason } — fail-closed semantics preserved.
//
// Hard prohibitions:
//   • Never sends the raw file content out of Supabase storage —
//     only a short-lived signed URL, fetched by OUR own VPS.
//   • Never calls Mistral / Google Vision / AWS Textract / OpenAI.
//   • Never writes to CRM tables, customer_files, student-docs,
//     crm_storage, document_lane_facts, document_review_queue.
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
    console.log(JSON.stringify({ fn: "paddle-structure", trace_id, stage, ts: new Date().toISOString(), ...payload }));
  } catch {
    console.log(`[paddle-structure] trace=${trace_id} stage=${stage}`);
  }
}

interface ReqBody {
  draft_id?: string;
  trace_id?: string;
  url_ttl_seconds?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonRes({ ok: false, reason: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const ENDPOINT = Deno.env.get("PADDLE_STRUCTURE_ENDPOINT");
  const API_KEY = Deno.env.get("PADDLE_API_KEY");

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

  // 1) caller JWT
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

  // 2) ownership check via service role (RLS-style)
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: draft, error: dErr } = await admin
    .from("portal_document_drafts")
    .select("id,student_user_id,draft_storage_bucket,draft_storage_path,mime_type,original_file_name")
    .eq("id", body.draft_id)
    .maybeSingle();
  if (dErr || !draft) {
    return jsonRes({ ok: false, reason: "draft_not_found", trace_id }, 404);
  }
  if (draft.student_user_id !== user_id) {
    return jsonRes({ ok: false, reason: "draft_forbidden", trace_id }, 403);
  }

  // 3) Endpoint configured?
  if (!ENDPOINT) {
    tlog(trace_id, "no_endpoint", {});
    return jsonRes({ ok: false, reason: "no_endpoint_configured", trace_id });
  }

  // 4) signed URL on portal-drafts bucket
  const ttl = Math.max(15, Math.min(120, body.url_ttl_seconds ?? 60));
  const { data: signed, error: sErr } = await admin
    .storage
    .from(draft.draft_storage_bucket || "portal-drafts")
    .createSignedUrl(draft.draft_storage_path, ttl);
  if (sErr || !signed?.signedUrl) {
    tlog(trace_id, "sign_failed", { error: sErr?.message });
    return jsonRes({ ok: false, reason: "sign_failed", trace_id }, 500);
  }

  // 5) POST to PaddleOCR VPS
  const t0 = Date.now();
  let upstream: Response;
  try {
    const ctl = new AbortController();
    const tmr = setTimeout(() => ctl.abort(), 25_000);
    upstream = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
      },
      body: JSON.stringify({
        signed_url: signed.signedUrl,
        mime_type: draft.mime_type ?? "application/octet-stream",
        file_name: draft.original_file_name,
        url_ttl_seconds: ttl,
      }),
      signal: ctl.signal,
    });
    clearTimeout(tmr);
  } catch (e) {
    tlog(trace_id, "upstream_unreachable", { error: (e as Error).message });
    return jsonRes({ ok: false, reason: "service_unreachable", trace_id });
  }

  const text = await upstream.text();
  if (!upstream.ok) {
    const reason = upstream.status >= 500 ? "service_5xx" : "service_error";
    tlog(trace_id, "upstream_error", { status: upstream.status, body: text.slice(0, 240) });
    return jsonRes({ ok: false, reason, http_status: upstream.status, trace_id });
  }

  let payload: any;
  try {
    payload = JSON.parse(text);
  } catch {
    return jsonRes({ ok: false, reason: "service_bad_json", trace_id });
  }

  tlog(trace_id, "ok", { pages: payload?.pages?.length ?? 0, ms: Date.now() - t0 });
  return jsonRes({
    ok: true,
    trace_id,
    pages: payload?.pages ?? [],
    reading_order: payload?.reading_order ?? [],
    build_time_ms: payload?.build_time_ms ?? (Date.now() - t0),
  });
});
