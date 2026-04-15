import { handleCorsPreflight, getCorsHeaders, generateTraceId, slog } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/adminGuard.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * admin-uniranks-import-stop: Stops an active import run.
 * POST { run_id: string }
 */
Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin);
  const tid = req.headers.get("x-client-trace-id") || generateTraceId();

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return json({ ok: false, error: auth.error, trace_id: tid }, auth.status, cors);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const srv = createClient(SUPABASE_URL, SRV_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const runId = body?.run_id;

    if (!runId) {
      // Stop any active run
      const { data: activeRun } = await srv
        .from("uniranks_import_runs")
        .select("id")
        .eq("status", "running")
        .limit(1)
        .maybeSingle();

      if (!activeRun) {
        return json({ ok: true, message: "no_active_run", trace_id: tid }, 200, cors);
      }

      await srv.from("uniranks_import_runs").update({
        status: "stopped",
        finished_at: new Date().toISOString(),
      }).eq("id", activeRun.id);

      slog({ tid, level: "info", action: "import_stopped", run_id: activeRun.id });
      return json({ ok: true, run_id: activeRun.id, trace_id: tid }, 200, cors);
    }

    // Stop specific run
    await srv.from("uniranks_import_runs").update({
      status: "stopped",
      finished_at: new Date().toISOString(),
    }).eq("id", runId);

    // Also stop cursor
    await srv.from("catalog_ingest_cursor")
      .update({ status: "stopped", updated_at: new Date().toISOString() })
      .like("key", "import_%");

    slog({ tid, level: "info", action: "import_stopped", run_id: runId });
    return json({ ok: true, run_id: runId, trace_id: tid }, 200, cors);
  } catch (err: any) {
    slog({ tid, level: "error", action: "import_stop_error", error: String(err) });
    return json({ ok: false, error: err?.message, trace_id: tid }, 500, cors);
  }
});

function json(data: any, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
