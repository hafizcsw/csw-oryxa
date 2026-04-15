/**
 * admin-publish-qs-drafts
 * 
 * Publishes QS program drafts in bulk using service_role.
 * Only publishes drafts from QS source universities.
 * 
 * POST { limit?: number, dry_run?: boolean }
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
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const srv = createClient(SUPABASE_URL, SRV_KEY);

  // Create authenticated client with admin's JWT for RPC calls that check auth.uid()
  const authHeader = req.headers.get("Authorization") ?? "";
  const adminClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(body.limit || 100, 500);
    const dryRun = body.dry_run === true;

    // ══════════════════════════════════════════════════════════════════════
    // SAFETY GATE: Only publish drafts that have approval_tier = 'auto'
    // AND are verified. Door5 drafts without approval_tier are BLOCKED.
    // ══════════════════════════════════════════════════════════════════════
    const { data: drafts, error: fetchErr } = await srv
      .from("program_draft")
      .select("id, university_id, title, schema_version, approval_tier, status")
      .in("schema_version", ["door2-detail-v1", "door5-programs-v1"])
      .eq("approval_tier", "auto")
      .in("status", ["verified"])
      .order("created_at", { ascending: true })
      .limit(limit);

    if (fetchErr) {
      return json({ ok: false, error: fetchErr.message, trace_id: tid }, 500, cors);
    }

    // Filter to QS source universities only
    const uniIds = [...new Set((drafts || []).map(d => d.university_id))];
    const { data: qsUnis } = await srv
      .from("uniranks_crawl_state")
      .select("university_id")
      .eq("source", "qs")
      .in("university_id", uniIds);

    const qsUniSet = new Set((qsUnis || []).map(u => u.university_id));
    const qsDrafts = (drafts || []).filter(d => qsUniSet.has(d.university_id));

    if (dryRun) {
      return json({
        ok: true,
        dry_run: true,
        total_fetched: drafts?.length || 0,
        qs_filtered: qsDrafts.length,
        sample: qsDrafts.slice(0, 10).map(d => ({ id: d.id, title: d.title })),
        trace_id: tid,
      }, 200, cors);
    }

    if (qsDrafts.length === 0) {
      return json({ ok: true, published: 0, message: "no_qs_drafts_to_publish", trace_id: tid }, 200, cors);
    }

    // Publish in chunks of 50 using direct SQL via service role
    const chunkSize = 50;
    let totalPublished = 0;
    let totalFailed = 0;
    const errors: any[] = [];

    for (let i = 0; i < qsDrafts.length; i += chunkSize) {
      const chunk = qsDrafts.slice(i, i + chunkSize);
      const chunkIds = chunk.map(d => d.id);

      // Call the RPC with service role (bypasses auth.uid() check)
      // Since rpc_publish_programs checks is_admin(auth.uid()), we need to use
      // the admin's JWT from the original request instead
      const { data: result, error: pubErr } = await adminClient.rpc("rpc_publish_programs", {
        p_program_draft_ids: chunkIds,
        p_trace_id: `QS-BULK-PUB-${tid}`,
      });

      if (pubErr) {
        totalFailed += chunkIds.length;
        errors.push({ chunk: i, error: pubErr.message });
      } else {
        const r = result as any;
        totalPublished += r?.inserted ?? 0;
        totalPublished += r?.updated ?? 0;
        if (r?.failed > 0) {
          totalFailed += r.failed;
          errors.push({ chunk: i, failed: r.failed, errors: r.errors });
        }
      }
    }

    // Telemetry
    await srv.from("pipeline_health_events").insert({
      pipeline: "qs_matched_crawl",
      event_type: "metric",
      metric: "bulk_publish",
      value: totalPublished,
      details_json: { trace_id: tid, published: totalPublished, failed: totalFailed, total_attempted: qsDrafts.length },
    });

    slog({ tid, level: "info", action: "qs_bulk_publish", published: totalPublished, failed: totalFailed });

    return json({
      ok: true,
      published: totalPublished,
      failed: totalFailed,
      total_attempted: qsDrafts.length,
      errors: errors.length > 0 ? errors : undefined,
      trace_id: tid,
    }, 200, cors);
  } catch (err: any) {
    slog({ tid, level: "error", action: "publish_error", error: String(err) });
    return json({ ok: false, error: err?.message, trace_id: tid }, 500, cors);
  }
});

function json(data: any, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
