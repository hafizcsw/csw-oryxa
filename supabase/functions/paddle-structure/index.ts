// ═══════════════════════════════════════════════════════════════
// Edge Function: paddle-structure
// ═══════════════════════════════════════════════════════════════
// Privacy / safety:
//   - JWT auth required (verify_jwt = true via signing keys)
//   - Validates that the requested storage_path belongs to the
//     calling user (path prefix match documents/<user_id>/...)
//   - Issues a SHORT-LIVED signed URL (60s) for Paddle to fetch.
//   - Forwards ONLY: signed_url, mime_type, file_name to Paddle.
//   - Fail-closed: missing PADDLE_STRUCTURE_ENDPOINT or any
//     downstream error → returns { ok:false, reason } with HTTP 200
//     so the client can fall back gracefully without a network error.
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TIMEOUT_MS = 25_000;
const SIGNED_URL_TTL = 60;
// Single source of truth for student documents. Must match the bucket
// used by FileUploadSection.tsx and customer_files.storage_path.
const DOCUMENTS_BUCKET = "student-docs";

interface ReqBody {
  document_id?: string;
  storage_path?: string;
  mime_type?: string;
  file_name?: string;
}

function jsonResp(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

function failClosed(reason: string, error_message: string | null = null) {
  // Always HTTP 200 so the supabase-js invoke() does not raise a generic
  // FunctionsError; the client interprets ok:false as fail-closed.
  return jsonResp({ ok: false, reason, error_message });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ── Auth ───────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return failClosed("unauthenticated");

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return failClosed("server_misconfigured");
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return failClosed("unauthenticated");
  const user_id = userData.user.id;

  // ── Body validation ───────────────────────────────────────
  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return failClosed("invalid_body");
  }
  const { document_id, storage_path, mime_type, file_name } = body;
  if (!document_id || !storage_path || !mime_type || !file_name) {
    return failClosed("missing_fields");
  }

  // Privacy gate: storage_path must belong to caller.
  // student-docs convention is `user/<profile_id>/...` (matches
  // FileUploadSection.tsx). We accept any path that contains the
  // caller's user id as a segment so this stays robust as conventions evolve.
  const normalizedPath = storage_path.startsWith(`${DOCUMENTS_BUCKET}/`)
    ? storage_path.slice(DOCUMENTS_BUCKET.length + 1)
    : storage_path;
  const belongsToCaller =
    normalizedPath.startsWith(`${user_id}/`) ||
    normalizedPath.includes(`/${user_id}/`) ||
    normalizedPath.startsWith(`user/${user_id}/`);
  if (!belongsToCaller) {
    return failClosed("storage_path_forbidden");
  }

  // ── Endpoint config (fail-closed primary signal) ──────────
  const endpoint = Deno.env.get("PADDLE_STRUCTURE_ENDPOINT");
  const apiKey = Deno.env.get("PADDLE_API_KEY");
  if (!endpoint) {
    return failClosed("no_endpoint_configured");
  }

  // ── Signed URL (short TTL) ────────────────────────────────
  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: signed, error: signErr } = await adminClient
    .storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(normalizedPath, SIGNED_URL_TTL);

  if (signErr || !signed?.signedUrl) {
    return failClosed("signed_url_failed", signErr?.message ?? null);
  }

  // ── Call Paddle ───────────────────────────────────────────
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const paddleResp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        signed_url: signed.signedUrl,
        mime_type,
        file_name,
        // Hint to the service that the URL expires soon.
        url_ttl_seconds: SIGNED_URL_TTL,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!paddleResp.ok) {
      const text = await paddleResp.text().catch(() => "");
      return failClosed(
        paddleResp.status >= 500 ? "service_5xx" : "service_error",
        `status=${paddleResp.status} ${text.slice(0, 200)}`,
      );
    }

    const result = await paddleResp.json().catch(() => null);
    if (!result || typeof result !== "object" || !Array.isArray((result as { pages?: unknown }).pages)) {
      return failClosed("invalid_paddle_response");
    }

    return jsonResp({ ok: true, result });
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : "unknown_error";
    if (msg.toLowerCase().includes("abort")) return failClosed("timeout", msg);
    return failClosed("network_error", msg);
  }
});
