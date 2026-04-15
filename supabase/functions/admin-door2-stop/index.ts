import { handleCorsPreflight, getCorsHeaders, generateTraceId, slog } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/adminGuard.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * admin-door2-stop: Pauses or disables Door2 harvester
 * POST { disable?: boolean }
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
    const disable = body?.disable === true;

    if (disable) {
      await srv.from("crawl_settings").upsert({
        key: "door2_enabled",
        value: { enabled: false },
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });
    } else {
      // Just pause
      const { data: configRow } = await srv
        .from("crawl_settings")
        .select("value")
        .eq("key", "door2_config")
        .single();

      const config = configRow?.value ?? {};
      await srv.from("crawl_settings").upsert({
        key: "door2_config",
        value: { ...config, pause: true },
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });
    }

    // Release all locks
    await srv
      .from("uniranks_crawl_state")
      .update({ locked_until: null, locked_by: null })
      .not("locked_until", "is", null);

    // Telemetry
    await srv.from("pipeline_health_events").insert({
      pipeline: "door2_harvester",
      event_type: "state",
      metric: disable ? "door2_disabled" : "door2_paused",
      value: 1,
      details_json: { trace_id: tid, disable },
    });

    slog({ tid, level: "info", action: disable ? "door2_disabled" : "door2_paused" });

    return json({ ok: true, trace_id: tid, action: disable ? "disabled" : "paused" }, 200, cors);
  } catch (err: any) {
    slog({ tid, level: "error", action: "door2_stop_error", error: String(err) });
    return json({ ok: false, error: err?.message, trace_id: tid }, 500, cors);
  }
});

function json(data: any, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
