import { handleCorsPreflight, getCorsHeaders, generateTraceId, slog } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/adminGuard.ts";

/** Parse crawl_settings.value for is_paused — handles boolean, string, or JSONB {paused:true} */
function parsePaused(v: any): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true";
  if (v && typeof v === "object" && "paused" in v) return !!v.paused;
  return false;
}

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

  try {
    const srv = auth.srv;

    // All queries in parallel
    const [
      crawlSettingRes,
      statusRes,
      sourceRes,
      websiteCountRes,
      programsRes,
      draftsRes,
      urlsStatusRes,
      urlsKindRes,
      lastTickRes,
      lastMetricsRes,
      errorsRes,
    ] = await Promise.all([
      // crawl paused
      srv.from("crawl_settings").select("value, updated_at").eq("key", "is_paused").single(),
      // universities by crawl_status
      Promise.resolve(null),
      // placeholder — we'll use raw approach below
      Promise.resolve(null),
      Promise.resolve(null),
      Promise.resolve(null),
      Promise.resolve(null),
      Promise.resolve(null),
      Promise.resolve(null),
      Promise.resolve(null),
      Promise.resolve(null),
      Promise.resolve(null),
    ]);

    // Since supabase-js doesn't support GROUP BY natively, we fetch with service role SQL via .rpc
    // We'll use individual queries with filtering instead

    // Crawl settings
    const crawlSetting = crawlSettingRes.data;
    const isPaused = parsePaused(crawlSetting?.value);

    // Crawl policy
    const { data: policySetting } = await srv
      .from("crawl_settings")
      .select("value")
      .eq("key", "crawl_policy")
      .single();

    const crawlPolicy = policySetting?.value ?? { mode: "official" };

    // Universities by status - use multiple count queries to avoid row limits
    const statuses = ["pending", "crawling", "done", "error", "new_from_catalog", "seeded_uniranks", "discovery_done_official", "uniranks_done"];
    const statusCounts = await Promise.all(
      statuses.map(s => srv.from("universities").select("id", { count: "exact", head: true }).eq("crawl_status", s))
    );
    const byStatus: Record<string, number> = {};
    statuses.forEach((s, i) => {
      const c = statusCounts[i].count ?? 0;
      if (c > 0) byStatus[s] = c;
    });

    // Total, with/without website, by source
    const [totalRes, withWebsiteRes] = await Promise.all([
      srv.from("universities").select("id", { count: "exact", head: true }),
      srv.from("universities").select("id", { count: "exact", head: true }).not("website", "is", null),
    ]);
    const totalUnis = totalRes.count ?? 0;
    const withWebsite = withWebsiteRes.count ?? 0;
    const withoutWebsite = totalUnis - withWebsite;

    // Website sources
    const sourcesNames = ["unknown", "uniranks_extracted", "official", "manual", "qs"];
    const sourceCounts = await Promise.all(
      sourcesNames.map(s => srv.from("universities").select("id", { count: "exact", head: true }).not("website", "is", null).eq("website_source", s))
    );
    const bySource: Record<string, number> = {};
    sourcesNames.forEach((s, i) => {
      const c = sourceCounts[i].count ?? 0;
      if (c > 0) bySource[s] = c;
    });

    // Programs count
    const { count: programsTotal } = await srv
      .from("programs")
      .select("id", { count: "exact", head: true });

    const { count: programsPublished } = await srv
      .from("programs")
      .select("id", { count: "exact", head: true })
      .eq("published", true)
      .eq("publish_status", "published");

    // Drafts by status — use count queries instead of fetching all rows
    const draftStatuses = ["extracted", "published", "pending", "error", "mapped", "draft"];
    const draftStatusCounts = await Promise.all(
      draftStatuses.map(s => srv.from("program_draft").select("id", { count: "exact", head: true }).eq("status", s))
    );
    const draftsByStatus: Record<string, number> = {};
    let draftsTotal = 0;
    draftStatuses.forEach((s, i) => {
      const c = draftStatusCounts[i].count ?? 0;
      if (c > 0) { draftsByStatus[s] = c; draftsTotal += c; }
    });

    // URLs by status and kind — use count queries instead of fetching all rows
    const urlStatuses = ["pending", "crawled", "extracted", "error", "skipped"];
    const urlKinds = ["program_list", "program_detail", "scholarship", "general"];
    const [urlStatusCounts, urlKindCounts] = await Promise.all([
      Promise.all(urlStatuses.map(s => srv.from("program_urls").select("id", { count: "exact", head: true }).eq("status", s))),
      Promise.all(urlKinds.map(k => srv.from("program_urls").select("id", { count: "exact", head: true }).eq("kind", k))),
    ]);
    const urlsByStatus: Record<string, number> = {};
    urlStatuses.forEach((s, i) => { const c = urlStatusCounts[i].count ?? 0; if (c > 0) urlsByStatus[s] = c; });
    const urlsByKind: Record<string, number> = {};
    urlKinds.forEach((k, i) => { const c = urlKindCounts[i].count ?? 0; if (c > 0) urlsByKind[k] = c; });

    // Runner health
    const { data: lastTickData } = await srv
      .from("pipeline_health_events")
      .select("created_at")
      .eq("pipeline", "crawl_runner")
      .order("created_at", { ascending: false })
      .limit(1);

    const lastTickAt = lastTickData?.[0]?.created_at ?? null;
    const isStale = lastTickAt
      ? (Date.now() - new Date(lastTickAt).getTime()) > 2 * 60 * 1000
      : true;

    const { data: lastMetrics } = await srv
      .from("pipeline_health_events")
      .select("metric, value, created_at")
      .eq("pipeline", "crawl_runner")
      .order("created_at", { ascending: false })
      .limit(20);

    // Errors
    const { data: recentErrors } = await srv
      .from("ingest_errors")
      .select("stage, reason, created_at, details_json")
      .order("created_at", { ascending: false })
      .limit(5);

    const errors = (recentErrors || []).map((e: any) => ({
      stage: e.stage,
      reason: e.reason,
      created_at: e.created_at,
      trace_id: e.details_json?.trace_id ?? null,
    }));

    // Logo stats + discovered count + cursor
    const [logoRes, discoveredRes, cursorRes] = await Promise.all([
      srv.from("universities").select("id", { count: "exact", head: true }).not("logo_url", "is", null),
      srv.from("universities").select("id", { count: "exact", head: true }).not("uniranks_profile_url", "is", null),
      srv.from("catalog_ingest_cursor").select("*").eq("key", "ranking").single(),
    ]);

    const withLogo = logoRes.count ?? 0;
    const universitiesDiscovered = discoveredRes.count ?? 0;
    const catalogCursor = cursorRes.data ?? null;

    const response = {
      trace_id: tid,
      now: new Date().toISOString(),
      crawl: {
        paused: isPaused,
        last_change_at: crawlSetting?.updated_at ?? null,
        policy: crawlPolicy,
        raw_value_type: typeof crawlSetting?.value,
        raw_value_preview: JSON.stringify(crawlSetting?.value)?.slice(0, 100),
      },
      universities: {
        by_status: byStatus,
        with_official_website: withWebsite,
        without_official_website: withoutWebsite,
        by_source: bySource,
      },
      pipeline: {
        programs_total: programsTotal ?? 0,
        programs_published: programsPublished ?? 0,
        programs_draft: draftsTotal,
        drafts_by_status: draftsByStatus,
        urls_by_status: urlsByStatus,
        urls_by_kind: urlsByKind,
        universities_with_logo: withLogo,
        universities_discovered: universitiesDiscovered,
        catalog_ingest_cursor: catalogCursor,
      },
      runner: {
        last_tick_at: lastTickAt,
        is_stale: isStale,
        last_metrics: lastMetrics ?? [],
      },
      errors,
    };

    slog({ tid, level: "info", action: "dashboard_metrics_served" });

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json", ...cors },
    });
  } catch (err) {
    slog({ tid, level: "error", error: String(err) });
    return new Response(
      JSON.stringify({ ok: false, error: String(err), trace_id: tid }),
      { status: 500, headers: { "Content-Type": "application/json", ...cors } }
    );
  }
});
