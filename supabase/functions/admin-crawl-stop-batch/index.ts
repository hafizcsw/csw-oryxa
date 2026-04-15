import { handleCorsPreflight, getCorsHeaders, generateTraceId, slog } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/adminGuard.ts";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin);
  const tid = req.headers.get("x-client-trace-id") || generateTraceId();

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed", trace_id: tid }), {
      status: 405, headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return new Response(
      JSON.stringify({ ok: false, error: auth.error, trace_id: tid }),
      { status: auth.status, headers: { "Content-Type": "application/json", ...cors } }
    );
  }

  try {
    const { batch_id } = await req.json();
    if (!batch_id || typeof batch_id !== "string") {
      return new Response(
        JSON.stringify({ ok: false, error: "missing_batch_id", trace_id: tid }),
        { status: 400, headers: { "Content-Type": "application/json", ...cors } }
      );
    }

    const srv = auth.srv;

    // Verify batch exists and is active
    const { data: batch, error: fetchErr } = await srv
      .from("crawl_batches")
      .select("id, status, finished_at")
      .eq("id", batch_id)
      .single();

    if (fetchErr || !batch) {
      return new Response(
        JSON.stringify({ ok: false, error: "batch_not_found", trace_id: tid }),
        { status: 404, headers: { "Content-Type": "application/json", ...cors } }
      );
    }

    if (batch.finished_at || batch.status === "done" || batch.status === "finished") {
      return new Response(
        JSON.stringify({ ok: true, already_stopped: true, trace_id: tid }),
        { status: 200, headers: { "Content-Type": "application/json", ...cors } }
      );
    }

    // Stop the batch via service role
    const { error: updateErr } = await srv
      .from("crawl_batches")
      .update({ status: "done", finished_at: new Date().toISOString() })
      .eq("id", batch_id);

    if (updateErr) throw updateErr;

    // Log telemetry — use details_json (not payload) per actual schema
    const { error: telemetryErr } = await srv.from("pipeline_health_events").insert({
      pipeline: "crawl_runner",
      batch_id,
      event_type: "state",
      metric: "batch_stopped",
      value: 1,
      details_json: { batch_id, stopped_by: auth.user.id, trace_id: tid },
    });

    const telemetry_ok = !telemetryErr;
    if (telemetryErr) {
      slog({ tid, level: "warn", action: "telemetry_insert_failed", error: String(telemetryErr) });
    }

    slog({ tid, level: "info", action: "batch_stopped", batch_id, admin: auth.user.id, telemetry_ok });

    return new Response(
      JSON.stringify({ ok: true, batch_id, telemetry_ok, trace_id: tid }),
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
