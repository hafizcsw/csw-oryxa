import { handleCorsPreflight, getCorsHeaders, generateTraceId, slog } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/adminGuard.ts";

Deno.serve(async (req) => {
  // 1) CORS preflight — before any work
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin);
  const tid = req.headers.get("x-client-trace-id") || generateTraceId();

  // 2) Admin check — reject immediately if not admin
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return new Response(
      JSON.stringify({ ok: false, error: auth.error, trace_id: tid }),
      { status: auth.status, headers: { "Content-Type": "application/json", ...cors } }
    );
  }

  // 3) Safe body parsing
  let paused: boolean;
  try {
    const text = await req.text();
    if (!text) {
      return new Response(
        JSON.stringify({ ok: false, error: "empty_request_body", trace_id: tid }),
        { status: 400, headers: { "Content-Type": "application/json", ...cors } }
      );
    }
    const body = JSON.parse(text);
    if (typeof body.paused !== "boolean") {
      return new Response(
        JSON.stringify({ ok: false, error: "paused must be boolean", trace_id: tid }),
        { status: 400, headers: { "Content-Type": "application/json", ...cors } }
      );
    }
    paused = body.paused;
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "invalid_json_body", trace_id: tid }),
      { status: 400, headers: { "Content-Type": "application/json", ...cors } }
    );
  }

  // 4) Call RPC via service_role
  try {
    const { error } = await auth.srv.rpc("rpc_set_crawl_paused", { p_paused: paused });
    if (error) throw error;

    // Read back the updated value
    const { data: setting } = await auth.srv
      .from("crawl_settings")
      .select("value, updated_at")
      .eq("key", "is_paused")
      .single();

    slog({ tid, level: "info", action: "crawl_pause_toggle", paused });

    return new Response(
      JSON.stringify({
        ok: true,
        paused,
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
