import { handleCorsPreflight, getCorsHeaders, generateTraceId, slog } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/adminGuard.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * admin-uniranks-import-start: Creates an import run + resets cursor → triggers first page.
 * POST { list_type?: string, from_page?: number, shards?: number }
 * 
 * Patch C (Gatekeeper #4): When shards > 1, archives old import_all cursor
 * and creates per-shard cursors with stride-based pages.
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
    const listType = body?.list_type ?? "all";
    const fromPage = body?.from_page ?? 0;
    const shards = Math.min(Math.max(body?.shards ?? 1, 1), 8); // 1-8 shards

    // Check for active runs
    const { data: activeRun } = await srv
      .from("uniranks_import_runs")
      .select("id, status")
      .eq("status", "running")
      .limit(1)
      .maybeSingle();

    if (activeRun) {
      return json({ ok: false, error: "import_already_running", run_id: activeRun.id, trace_id: tid }, 409, cors);
    }

    // Create run record
    const { data: run, error: runErr } = await srv
      .from("uniranks_import_runs")
      .insert({
        status: "running",
        list_type: listType,
        trace_id: tid,
      })
      .select("id")
      .single();

    if (runErr || !run) {
      return json({ ok: false, error: runErr?.message || "failed_to_create_run", trace_id: tid }, 500, cors);
    }

    let shardKeys: string[] = [];
    let shardPages: number[] = [];

    if (shards > 1) {
      // ===== Patch C: Shard mode =====

      // Gatekeeper #4: Archive old import_all cursor to prevent double-processing
      const oldCursorKey = `import_${listType}`;
      await srv.from("catalog_ingest_cursor").update({
        status: "archived",
        meta: { archived_by: "shard_start", archived_at: new Date().toISOString(), replaced_by_shards: shards, trace_id: tid },
        updated_at: new Date().toISOString(),
      }).eq("key", oldCursorKey).neq("status", "archived");

      slog({ tid, level: "info", action: "old_cursor_archived", key: oldCursorKey, shards });

      // Determine starting page: use from_page OR read from old cursor
      let basePage = fromPage;
      if (fromPage === 0) {
        // Try to read last known page from old cursor
        const { data: oldCursor } = await srv
          .from("catalog_ingest_cursor")
          .select("page")
          .eq("key", oldCursorKey)
          .single();
        if (oldCursor && oldCursor.page > 0) {
          basePage = oldCursor.page;
        }
      }

      // Create shard cursors with stride-based starting pages
      for (let i = 0; i < shards; i++) {
        const shardKey = `import_${listType}_s${i}`;
        const shardStartPage = basePage + i;
        shardKeys.push(shardKey);
        shardPages.push(shardStartPage);

        await srv.from("catalog_ingest_cursor").upsert({
          key: shardKey,
          page: shardStartPage,
          status: "pending",
          last_run_at: new Date().toISOString(),
          last_trace_id: tid,
          meta: { run_id: run.id, list_type: listType, shard_index: i, stride: shards, base_page: basePage },
          updated_at: new Date().toISOString(),
        }, { onConflict: "key" });
      }

      slog({ tid, level: "info", action: "shards_created", shards, base_page: basePage, shard_keys: shardKeys });
    } else {
      // ===== Single cursor mode =====
      const cursorKey = `import_${listType}`;
      shardKeys = [cursorKey];

      // If from_page is 0, try to resume from existing cursor (don't rewind!)
      let actualFromPage = fromPage;
      if (fromPage === 0) {
        const { data: existingCursor } = await srv
          .from("catalog_ingest_cursor")
          .select("page, status")
          .eq("key", cursorKey)
          .single();
        if (existingCursor && existingCursor.page > 0 && existingCursor.status !== "done") {
          actualFromPage = existingCursor.page;
          slog({ tid, level: "info", action: "resume_from_existing", key: cursorKey, page: actualFromPage });
        }
      }

      shardPages = [actualFromPage];

      await srv.from("catalog_ingest_cursor").upsert({
        key: cursorKey,
        page: actualFromPage,
        status: "pending",
        last_run_at: new Date().toISOString(),
        last_trace_id: tid,
        meta: { run_id: run.id, list_type: listType },
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });
    }

    // Emit telemetry
    await srv.from("pipeline_health_events").insert({
      pipeline: "catalog_import",
      event_type: "metric",
      metric: "import_started",
      value: shardPages[0],
      details_json: { trace_id: tid, run_id: run.id, list_type: listType, from_page: shardPages[0], shards, shard_keys: shardKeys },
    });

    slog({ tid, level: "info", action: "import_started", run_id: run.id, list_type: listType, from_page: shardPages[0], shards });

    return json({
      ok: true,
      run_id: run.id,
      trace_id: tid,
      cursor_key: shardKeys[0],
      from_page: shardPages[0],
      shards,
      shard_keys: shardKeys,
      shard_pages: shardPages,
    }, 200, cors);
  } catch (err: any) {
    slog({ tid, level: "error", action: "import_start_error", error: String(err) });
    return json({ ok: false, error: err?.message, trace_id: tid }, 500, cors);
  }
});

function json(data: any, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
