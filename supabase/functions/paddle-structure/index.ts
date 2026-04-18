// ═══════════════════════════════════════════════════════════════
// Edge Function: paddle-structure
// ═══════════════════════════════════════════════════════════════
// Privacy / safety:
//   - JWT auth required (validated in code via getUser)
//   - Validates that the requested storage_path belongs to the
//     calling user (path prefix match user/<profile_id>/...)
//   - Issues a SHORT-LIVED signed URL (60s) for Paddle to fetch.
//   - Forwards ONLY: signed_url, mime_type, file_name to Paddle.
//   - Fail-closed: missing PADDLE_STRUCTURE_ENDPOINT or any
//     downstream error → returns { ok:false, reason } with HTTP 200
//     so the client can fall back gracefully without a network error.
//
// Bucket: student-docs (single source of truth — matches
// FileUploadSection.tsx and customer_files.storage_path).
// ═══════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TIMEOUT_MS = 25_000;
const SIGNED_URL_TTL = 60;
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
  console.log("[paddle-structure] ✗ failClosed", { reason, error_message });
  return jsonResp({ ok: false, reason, error_message });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  console.log("[paddle-structure] ▶ request received", { method: req.method, ts: Date.now() });

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
  // student-docs convention is `user/<profile_id>/...` — but profile_id
  // ≠ auth user_id. We resolve the caller's profile_id from the profiles
  // table, and accept the path if it matches either auth user_id or
  // profile_id (which is what the upload flow actually writes).
  const normalizedPath = storage_path.startsWith(`${DOCUMENTS_BUCKET}/`)
    ? storage_path.slice(DOCUMENTS_BUCKET.length + 1)
    : storage_path;

  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
  // Look up profile_id for this auth user (the FileUploadSection writes
  // `user/<profile_id>/...`, where profile_id = profiles.id).
  let profile_id: string | null = null;
  try {
    const { data: profileRow } = await adminClient
      .from("profiles")
      .select("id, customer_id")
      .eq("user_id", user_id)
      .maybeSingle();
    profile_id = (profileRow?.id ?? profileRow?.customer_id ?? null) as string | null;
  } catch (_e) {
    // profile lookup is best-effort; the path check below still allows
    // the auth-uid form which other flows use.
  }

  const acceptedPrefixes = [
    `${user_id}/`,
    `user/${user_id}/`,
    ...(profile_id ? [`${profile_id}/`, `user/${profile_id}/`] : []),
  ];
  const belongsToCaller = acceptedPrefixes.some((p) =>
    normalizedPath.startsWith(p) || normalizedPath.includes(`/${p}`),
  );

  if (!belongsToCaller) {
    console.log("[paddle-structure] ✗ storage_path_forbidden", {
      normalizedPath,
      user_id,
      profile_id,
      acceptedPrefixes,
    });
    return failClosed("storage_path_forbidden");
  }

  // ── Endpoint config (fail-closed primary signal) ──────────
  const endpoint = Deno.env.get("PADDLE_STRUCTURE_ENDPOINT");
  const apiKey = Deno.env.get("PADDLE_API_KEY");
  if (!endpoint) {
    return failClosed("no_endpoint_configured");
  }

  // ── Signed URL (short TTL) ────────────────────────────────
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
        url_ttl_seconds: SIGNED_URL_TTL,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const rawText = await paddleResp.text().catch(() => "");
    console.log("[paddle-structure] upstream", {
      endpoint,
      status: paddleResp.status,
      file_name,
      mime_type,
      body_preview: rawText.slice(0, 500),
    });

    if (!paddleResp.ok) {
      return failClosed(
        paddleResp.status >= 500 ? "service_5xx" : "service_error",
        `status=${paddleResp.status} ${rawText.slice(0, 200)}`,
      );
    }

    let result: unknown = null;
    try { result = JSON.parse(rawText); } catch { /* noop */ }
    if (!result || typeof result !== "object" || !Array.isArray((result as { pages?: unknown }).pages)) {
      return failClosed("invalid_paddle_response", `body=${rawText.slice(0, 300)}`);
    }

    return jsonResp({ ok: true, result });
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : "unknown_error";
    if (msg.toLowerCase().includes("abort")) return failClosed("timeout", msg);
    return failClosed("network_error", msg);
  }
});
