/**
 * qs-matched-crawl-launch
 * 
 * Seeds uniranks_crawl_state from qs_slug_staging (matched-only),
 * configures door2_sequential_config for autonomous QS crawl,
 * and returns preflight + launch evidence.
 * 
 * POST { action: "preflight" | "seed" | "launch" | "status", batch_size?: number }
 * 
 * - preflight: returns counts only, no mutations
 * - seed: inserts/updates crawl_state rows from matched staging
 * - launch: seeds + activates sequential mode with source=qs
 * - status: returns current crawl progress
 */
import { handleCorsPreflight, getCorsHeaders, generateTraceId, slog } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/adminGuard.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const action = body.action || "preflight";
    const batchSize = Math.min(body.batch_size || 5, 10); // sequential batch size per tick

    // ══════════════════════════════════════════════
    // PREFLIGHT: Hard counts from qs_slug_staging
    // ══════════════════════════════════════════════
    const [totalRes, matchedRes, ambiguousRes, unmatchedRes] = await Promise.all([
      srv.from("qs_slug_staging").select("slug", { count: "exact", head: true }),
      srv.from("qs_slug_staging").select("slug", { count: "exact", head: true }).eq("match_status", "matched"),
      srv.from("qs_slug_staging").select("slug", { count: "exact", head: true }).eq("match_status", "ambiguous"),
      srv.from("qs_slug_staging").select("slug", { count: "exact", head: true }).eq("match_status", "unmatched"),
    ]);

    const counts = {
      total_staging: totalRes.count ?? 0,
      matched: matchedRes.count ?? 0,
      ambiguous: ambiguousRes.count ?? 0,
      unmatched: unmatchedRes.count ?? 0,
      will_crawl: matchedRes.count ?? 0,
      source_filter: "qs_slug_staging.match_status = 'matched' ONLY",
      excludes: ["ambiguous", "unmatched", "guessed slugs", "universities not in staging"],
    };

    if (action === "preflight") {
      // Also check existing crawl_state overlap
      const { count: existingQs } = await srv
        .from("uniranks_crawl_state")
        .select("university_id", { count: "exact", head: true })
        .eq("source", "qs");

      const { data: seqConfig } = await srv
        .from("crawl_settings")
        .select("value")
        .eq("key", "door2_sequential_config")
        .single();

      return json({
        ok: true,
        action: "preflight",
        counts,
        existing_qs_in_crawl_state: existingQs ?? 0,
        current_sequential_config: seqConfig?.value ?? null,
        trace_id: tid,
      }, 200, cors);
    }

    // ══════════════════════════════════════════════
    // SEED: Bulk insert/update crawl_state from matched staging
    // ══════════════════════════════════════════════
    if (action === "seed" || action === "launch") {
      const runId = `QS-MATCHED-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${tid.slice(-6)}`;

      // Fetch all matched rows in chunks and bulk upsert
      let offset = 0;
      const chunkSize = 500;
      let totalSeeded = 0;
      let totalUpdated = 0;
      let totalSkipped = 0;
      const now = new Date().toISOString();

      while (true) {
        const { data: matchedRows } = await srv
          .from("qs_slug_staging")
          .select("slug, match_university_id")
          .eq("match_status", "matched")
          .not("match_university_id", "is", null)
          .order("slug", { ascending: true })
          .range(offset, offset + chunkSize - 1);

        if (!matchedRows || matchedRows.length === 0) break;

        // Build upsert batch
        const upsertRows = matchedRows.map(row => ({
          university_id: row.match_university_id,
          source: "qs",
          source_profile_url: `https://www.topuniversities.com/universities/${row.slug}`,
          entity_type: "university",
          qs_slug: row.slug,
          stage: "profile_pending",
          door2_run_id: runId,
          locked_until: null,
          locked_by: null,
          retry_count: 0,
          quarantine_reason: null,
          quarantined_at: null,
          updated_at: now,
        }));

        const { error: upsertErr, count } = await srv
          .from("uniranks_crawl_state")
          .upsert(upsertRows, { onConflict: "university_id", count: "exact" });

        if (upsertErr) {
          console.warn(`[seed] bulk upsert error at offset ${offset}: ${upsertErr.message}`);
          totalSkipped += matchedRows.length;
        } else {
          totalUpdated += matchedRows.length;
        }

        offset += chunkSize;
        slog({ tid, level: "info", action: "seed_chunk", offset, processed: totalUpdated });
      }

      const seedResult = {
        run_id: runId,
        total_seeded_new: totalSeeded,
        total_updated_existing: totalUpdated,
        total_skipped: totalSkipped,
        total_queued: totalSeeded + totalUpdated,
      };

      // Telemetry
      await srv.from("pipeline_health_events").insert({
        pipeline: "qs_matched_crawl",
        event_type: "state",
        metric: "seed_complete",
        value: seedResult.total_queued,
        details_json: { ...seedResult, trace_id: tid },
      });

      if (action === "seed") {
        return json({ ok: true, action: "seed", counts, seed: seedResult, trace_id: tid }, 200, cors);
      }

      // ══════════════════════════════════════════════
      // LAUNCH: Activate sequential mode with source=qs
      // ══════════════════════════════════════════════

      // Set door2_sequential_config → source: "qs", mode: "sequential"
      const seqConfigValue = {
        mode: "sequential",
        source: "qs",
        batch_size: batchSize,
        batch_university_ids: [], // empty = let rpc pick next batch
        batch_number: 0,
        total_batches_completed: 0,
        run_id: runId,
        started_at: new Date().toISOString(),
        launched_by: "qs-matched-crawl-launch",
        source_filter: "qs_slug_staging.match_status=matched",
      };

      await srv.from("crawl_settings").upsert({
        key: "door2_sequential_config",
        value: seqConfigValue,
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });

      // Unpause crawl
      await srv.from("crawl_settings").upsert({
        key: "is_paused",
        value: { paused: false },
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });

      // Set crawl policy mode
      await srv.from("crawl_settings").upsert({
        key: "crawl_policy",
        value: { mode: "qs", catalog_ingest_enabled: false },
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });

      // Telemetry
      await srv.from("pipeline_health_events").insert({
        pipeline: "qs_matched_crawl",
        event_type: "state",
        metric: "launch",
        value: seedResult.total_queued,
        details_json: {
          trace_id: tid,
          run_id: runId,
          config: seqConfigValue,
          seed: seedResult,
          counts,
        },
      });

      slog({ tid, level: "info", action: "qs_matched_crawl_launched", run_id: runId, queued: seedResult.total_queued });

      // Get initial stage breakdown
      const stages = ["profile_pending", "programs_pending", "done", "quarantined"];
      const stageCounts = await Promise.all(
        stages.map(s => srv.from("uniranks_crawl_state")
          .select("university_id", { count: "exact", head: true })
          .eq("source", "qs")
          .eq("door2_run_id", runId)
          .eq("stage", s))
      );
      const stageBreakdown: Record<string, number> = {};
      stages.forEach((s, i) => { stageBreakdown[s] = stageCounts[i].count ?? 0; });

      return json({
        ok: true,
        action: "launch",
        trace_id: tid,
        run_id: runId,
        counts,
        seed: seedResult,
        stage_breakdown: stageBreakdown,
        sequential_config: seqConfigValue,
        execution: {
          mode: "server_side_autonomous",
          driver: "pg_cron job #21 (door2-crawl-runner-tick, every minute)",
          requires_browser: false,
          continues_when_offline: true,
        },
        message: "QS matched-only crawl launched. pg_cron will process batches autonomously.",
      }, 200, cors);
    }

    // ══════════════════════════════════════════════
    // STATUS: Current crawl progress
    // ══════════════════════════════════════════════
    if (action === "status") {
      const { data: seqConfig } = await srv
        .from("crawl_settings")
        .select("value, updated_at")
        .eq("key", "door2_sequential_config")
        .single();

      const config = seqConfig?.value ?? {};
      const runId = config.run_id || null;

      let stageBreakdown: Record<string, number> = {};
      if (runId) {
        const stages = ["profile_pending", "programs_pending", "done", "quarantined"];
        const stageCounts = await Promise.all(
          stages.map(s => srv.from("uniranks_crawl_state")
            .select("university_id", { count: "exact", head: true })
            .eq("source", "qs")
            .eq("door2_run_id", runId)
            .eq("stage", s))
        );
        stages.forEach((s, i) => { stageBreakdown[s] = stageCounts[i].count ?? 0; });
      }

      // Recent health events
      const { data: recentEvents } = await srv
        .from("pipeline_health_events")
        .select("metric, value, created_at, details_json")
        .eq("pipeline", "qs_matched_crawl")
        .order("created_at", { ascending: false })
        .limit(10);

      return json({
        ok: true,
        action: "status",
        run_id: runId,
        config,
        stage_breakdown: stageBreakdown,
        recent_events: recentEvents ?? [],
        trace_id: tid,
      }, 200, cors);
    }

    return json({ ok: false, error: `unknown action: ${action}` }, 400, cors);
  } catch (err: any) {
    slog({ tid, level: "error", action: "qs_matched_crawl_error", error: String(err) });
    return json({ ok: false, error: err?.message, trace_id: tid }, 500, cors);
  }
});

function json(data: any, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
