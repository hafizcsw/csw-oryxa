import { handleCorsPreflight, getCorsHeaders, generateTraceId, slog } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/adminGuard.ts";

const VALID_MODES = ["official", "uniranks", "qs", "hybrid"];

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin);
  const tid = req.headers.get("x-client-trace-id") || generateTraceId();

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return new Response(
      JSON.stringify({ ok: false, error: auth.error, trace_id: tid }),
      { status: auth.status, headers: { "Content-Type": "application/json", ...cors } }
    );
  }

  let policy: any;
  try {
    const text = await req.text();
    if (!text) {
      return new Response(
        JSON.stringify({ ok: false, error: "empty_request_body", trace_id: tid }),
        { status: 400, headers: { "Content-Type": "application/json", ...cors } }
      );
    }
    const body = JSON.parse(text);
    policy = body.policy;
    if (!policy || typeof policy !== "object" || !VALID_MODES.includes(policy.mode)) {
      return new Response(
        JSON.stringify({ ok: false, error: `Invalid mode. Must be one of: ${VALID_MODES.join(", ")}`, trace_id: tid }),
        { status: 400, headers: { "Content-Type": "application/json", ...cors } }
      );
    }
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "invalid_json_body", trace_id: tid }),
      { status: 400, headers: { "Content-Type": "application/json", ...cors } }
    );
  }

  try {
    const { error } = await auth.srv.rpc("rpc_set_crawl_policy", { p_policy: policy });
    if (error) throw error;

    const { data: setting } = await auth.srv
      .from("crawl_settings")
      .select("value, updated_at")
      .eq("key", "crawl_policy")
      .single();

    slog({ tid, level: "info", action: "crawl_policy_set", mode: policy.mode });

    return new Response(
      JSON.stringify({
        ok: true,
        policy: setting?.value ?? policy,
        updated_at: setting?.updated_at ?? new Date().toISOString(),
        trace_id: tid,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...cors } }
    );
  } catch (err) {
    slog({ tid, level: "error", error: String(err) });
    return new Response(
      JSON.stringify({ ok: false, error: String(err), trace_id: tid }),
      { status: 500, headers: { "Content-Type": "application/json", ...cors } }
    );
  }
});
