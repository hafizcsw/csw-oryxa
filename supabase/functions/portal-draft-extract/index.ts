// ═══════════════════════════════════════════════════════════════
// portal-draft-extract — DEPRECATED (Order 3R)
// ───────────────────────────────────────────────────────────────
// This function previously called Mistral OCR + Mistral LLM on raw
// portal-drafts files. Mistral is now disabled for the Study File
// path: raw student files must not leave CSW-controlled infra.
//
// The function is kept ONLY so historical clients/UI invocations do
// not 404 — it now fails closed with a deprecation error and writes
// the draft into extraction_failed with a clear reason.
//
// Replacement: invoke `oryxa-ai-provider` (DeepSeek transitional)
// with task_type = "document_extraction" and ocr_text supplied by
// an internal/local OCR step (not yet wired for Study File).
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const trace_id = req.headers.get("x-portal-trace-id") ?? `pde_${crypto.randomUUID()}`;
  let body: { draft_id?: string } = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  // Best-effort: mark the draft as extraction_failed with the deprecation reason
  // so the Study File UI surfaces the new state instead of pending forever.
  if (body?.draft_id && SUPABASE_URL && SERVICE_KEY) {
    try {
      const admin = createClient(SUPABASE_URL, SERVICE_KEY);
      await admin
        .from("portal_document_drafts")
        .update({
          extraction_status: "extraction_failed",
          extraction_error: "external_ai_provider_disabled:mistral_deprecated",
          extraction_completed_at: new Date().toISOString(),
          extraction_trace_id: trace_id,
        })
        .eq("id", body.draft_id);
    } catch (_e) {
      /* swallow — fail-closed below regardless */
    }
  }

  console.log(JSON.stringify({
    fn: "portal-draft-extract",
    stage: "deprecated_invocation_blocked",
    trace_id,
    draft_id: body?.draft_id ?? null,
    ts: new Date().toISOString(),
  }));

  return jsonRes(
    {
      ok: false,
      error: "external_ai_provider_disabled",
      provider: "mistral",
      policy: "oryxa_internal_first",
      replacement_function: "oryxa-ai-provider",
      trace_id,
    },
    410,
  );
});
