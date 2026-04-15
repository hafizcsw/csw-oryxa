import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractETLD1 } from "../_shared/url-utils.ts";
import { requireAdmin } from "../_shared/adminGuard.ts";

/**
 * crawl-runner-tick: Always-On 24/7 Crawl Runner
 * Called every minute by pg_cron. Orchestrates the full pipeline.
 *
 * PATCH 1: Observability — always log health event (even paused) with event_type
 * PATCH 2: Decouple uniranks mode — run direct lane without requiring official batch
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-client-trace-id, x-orxya-ingress",
};

const TICK_TIMEOUT_MS = 50_000;
const FETCH_TIMEOUT_MS = 12_000;
const UA = "LavistaCrawler/1.0 (+https://connectstudyworld.com)";

// ===== Health Event Helper (ensures event_type is ALWAYS set) =====

async function insertHealthEvents(
  supabase: any,
  events: Array<{
    pipeline: string;
    event_type?: string;
    metric: string;
    value: number;
    shard_id?: number;
    window_start?: string;
    details?: any;
    trace_id?: string;
    payload?: any;
  }>
) {
  const rows = events.map(e => ({
    pipeline: e.pipeline,
    event_type: e.event_type || "metric",
    metric: e.metric,
    value: e.value,
    shard_id: e.shard_id ?? null,
    window_start: e.window_start || new Date().toISOString(),
    details_json: {
      ...(e.details ?? {}),
      ...(e.payload ?? {}),
      trace_id: e.trace_id ?? null,
    },
  }));
  if (rows.length > 0) {
    const { error } = await supabase.from("pipeline_health_events").insert(rows);
    if (error) console.warn("[health-insert] Error:", error.message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startMs = Date.now();
  const traceId = req.headers.get("x-client-trace-id") || `tick-${Date.now()}`;
  const metrics: Record<string, number> = {};

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SRV_KEY);

  // Auth: accept service_role Bearer OR pg_cron body OR admin JWT
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader !== `Bearer ${SRV_KEY}`) {
    const clonedReq = req.clone();
    const body = await clonedReq.json().catch(() => ({}));
    if (!body?.time) {
      const adminCheck = await requireAdmin(req);
      if (!adminCheck.ok) {
        return json({ error: "unauthorized" }, 401);
      }
    }
  }

  try {
    // ====== 1. Kill Switch + Policy ======
    const [pauseRes, policyRes, shardRes] = await Promise.all([
      supabase.from("crawl_settings").select("value").eq("key", "is_paused").single(),
      supabase.from("crawl_settings").select("value").eq("key", "crawl_policy").single(),
      supabase.from("crawl_settings").select("value").eq("key", "shard_config").single(),
    ]);

    const crawlPolicy = policyRes.data?.value ?? { mode: "official" };
    const crawlMode: string = crawlPolicy.mode ?? "official";
    const activeShards: number[] = shardRes.data?.value?.active_shards ?? [0];
    const currentMinute = new Date().getMinutes();
    const shardId = activeShards[currentMinute % activeShards.length];

    // ====== PATCH 1: Always log health even when paused ======
    if (pauseRes.data?.value?.paused) {
      await insertHealthEvents(supabase, [
        {
          pipeline: "crawl_runner",
          event_type: "state",
          metric: "tick",
          value: 1,
          shard_id: shardId,
          trace_id: traceId,
          payload: {
            status: "paused",
            paused_bool: true,
            mode: crawlMode,
            shard: shardId,
            elapsed_ms: Date.now() - startMs,
            counters: { urls_seeded: 0, urls_discovered: 0, pages_fetched: 0, programs_extracted: 0, uniranks_direct_processed: 0, logos_fetched: 0 },
          },
        },
      ]);
      return json({ status: "paused", trace_id: traceId, mode: crawlMode, shard_id: shardId, elapsed_ms: Date.now() - startMs });
    }

    // ====== 2. Reset Stuck Locks ======
    const { data: resetResult } = await supabase.rpc("rpc_reset_stuck_locks");
    metrics.locks_reset = (resetResult?.urls_reset ?? 0) + (resetResult?.universities_reset ?? 0);

    if (elapsed(startMs) > TICK_TIMEOUT_MS) return json({ status: "timeout_after_reset", metrics, shard_id: shardId, trace_id: traceId });

    // ====== STAGE 0: Optional Catalog Ingest (if enabled in policy) ======
    if (elapsed(startMs) < TICK_TIMEOUT_MS && crawlPolicy?.catalog_ingest_enabled) {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/crawl-catalog-ingest`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SRV_KEY}`,
            "Content-Type": "application/json",
            "x-client-trace-id": traceId,
          },
          body: JSON.stringify({ key: "ranking" }),
          signal: AbortSignal.timeout(10_000),
        });
        if (r.ok) {
          const result = await r.json();
          metrics.catalog_ingest_page = result?.page ?? 0;
          metrics.catalog_inserted = result?.inserted ?? 0;
          metrics.catalog_updated = result?.updated ?? 0;
        } else {
          await r.text().catch(() => {});
        }
      } catch (e: any) {
        console.warn("[stage0-catalog-ingest] Non-fatal:", e?.message);
      }
    }

    // ====== SEQUENTIAL BATCH MODE: Process universities one batch at a time ======

    // Read sequential config
    const { data: seqConfigRow } = await supabase
      .from("crawl_settings").select("value").eq("key", "door2_sequential_config").single();
    const seqConfig = seqConfigRow?.value ?? {};
    const sequentialMode = seqConfig.mode === "sequential";
    let currentBatchIds: string[] = seqConfig.batch_university_ids ?? [];
    const seqBatchSize = seqConfig.batch_size || 5;
    // Source is locked for the entire run — no parallel sources allowed
    const door2Source: string = seqConfig.source || "uniranks"; // "uniranks" | "qs"

    // ══════════════════════════════════════════════════════════════════════
    // HARD FREEZE — Phase 1 Safety Repair (2026-03-18)
    // Sequential mode (UniRanks/QS harvest+detail) and Legacy mode
    // (UniRanks direct + Door2 harvest) are FROZEN.
    // No dispatch to non-official source lanes.
    // Freeze reason: official-site-only lane policy.
    // ══════════════════════════════════════════════════════════════════════
    if (sequentialMode || true) {
      // ALL non-official dispatch lanes are frozen
      metrics.sequential_mode_frozen = 1;
      metrics.door2_processed = 0;
      metrics.door2_details_extracted = 0;
      metrics.uniranks_direct_processed = 0;
      await insertHealthEvents(supabase, [{
        pipeline: "crawl_runner",
        event_type: "freeze",
        metric: "non_official_lanes_frozen",
        value: 1,
        shard_id: shardId,
        trace_id: traceId,
        payload: { reason: "phase1_official_site_only", frozen_lanes: ["sequential_uniranks", "sequential_qs", "legacy_uniranks_direct", "legacy_door2_harvest"] },
      }]);
    }

    // ====== STAGE 1: Resolve Websites ======
    if (elapsed(startMs) < TICK_TIMEOUT_MS) {
      metrics.websites_resolved = await resolveWebsitesViaWorker(supabase, traceId, 10);
    }

    // ====== STAGE 1.5: Seed Program URLs ======
    if (elapsed(startMs) < TICK_TIMEOUT_MS) {
      metrics.urls_seeded = await seedProgramUrls(crawlMode, traceId, crawlPolicy);
    }

    // ====== 3. Get active batch (or create one) — PATCH 2: no early return in uniranks mode ======
    let batchId = await getOrCreateBatch(supabase, shardId);
    let noBatchReason: string | null = null;
    if (!batchId) {
      noBatchReason = "no_official_batch";
      // In uniranks/hybrid mode, this is expected — continue without official stages
      if (crawlMode !== "uniranks" && crawlMode !== "hybrid") {
        // Official mode with no batch → resolve and return
        await insertHealthEvents(supabase, [{
          pipeline: "crawl_runner",
          event_type: "state",
          metric: "tick",
          value: 1,
          shard_id: shardId,
          trace_id: traceId,
          payload: {
            status: "no_batch",
            paused_bool: false,
            mode: crawlMode,
            shard: shardId,
            elapsed_ms: Date.now() - startMs,
            counters: metrics,
          },
        }]);
        return json({ status: "no_batch", metrics, shard_id: shardId, trace_id: traceId, elapsed_ms: Date.now() - startMs });
      }
    }

    // ====== Official stages (only if batch exists) ======
    if (batchId) {
      // STAGE 2: Discover Program URLs
      if (elapsed(startMs) < TICK_TIMEOUT_MS) {
        metrics.urls_discovered = await discoverProgramUrls(supabase, batchId, 3);
      }

      // STAGE 3: Fetch Pages
      if (elapsed(startMs) < TICK_TIMEOUT_MS) {
        const fetchResult = await fetchPages(supabase, batchId, 10);
        metrics.pages_fetched = fetchResult.fetched;
        metrics.pages_failed = fetchResult.failed;
      }

      // STAGE 4: Extract Programs
      if (elapsed(startMs) < TICK_TIMEOUT_MS) {
        metrics.programs_extracted = await extractPrograms(supabase, batchId, 5);
      }

      // STAGE 5: Verify Drafts
      if (elapsed(startMs) < TICK_TIMEOUT_MS) {
        const verifyResult = await verifyDrafts(supabase, batchId, 20);
        metrics.verified_auto = verifyResult.auto;
        metrics.verified_deep = verifyResult.deep;
      }

      // STAGE 6: Publish — FROZEN (phase1_official_site_only)
      // No auto-publish from non-official-site sources
      metrics.published = 0;
      metrics.publish_frozen = 1;
    } else {
      // ====== Batchless Stages 3-6: Always-On Pipeline ======

      // STAGE 3 (batchless): Fetch Pages
      if (elapsed(startMs) < TICK_TIMEOUT_MS) {
        const fetchResult = await fetchPagesBatchless(supabase, 5);
        metrics.pages_fetched = fetchResult.fetched;
        metrics.pages_failed = fetchResult.failed;
      }

      // STAGE 4 (batchless): Extract Programs
      if (elapsed(startMs) < TICK_TIMEOUT_MS) {
        metrics.programs_extracted = await extractProgramsBatchless(supabase, 3);
      }

      // STAGE 5 (batchless): Verify Drafts
      if (elapsed(startMs) < TICK_TIMEOUT_MS) {
        const verifyResult = await verifyDraftsBatchless(supabase, 10);
        metrics.verified_auto = verifyResult.auto;
        metrics.verified_deep = verifyResult.deep;
      }

      // STAGE 6 (batchless): Publish — FROZEN (phase1_official_site_only)
      metrics.published = 0;
      metrics.publish_frozen = 1;
    }

    // ====== STAGE 7: Logo Lane (always runs) ======
    if (elapsed(startMs) < TICK_TIMEOUT_MS) {
      metrics.logos_fetched = await fetchLogos(supabase, traceId, 5);
    }

    // ====== Sync batch counters ======
    if (batchId) {
      await syncBatchCounters(supabase, batchId, metrics);
    }

    // ====== Log Health Metrics (PATCH 1: via helper with event_type) ======
    const healthPayload = {
      status: "ok",
      paused_bool: false,
      mode: crawlMode,
      shard: shardId,
      elapsed_ms: Date.now() - startMs,
      no_batch_reason: noBatchReason,
      counters: metrics,
    };

    const healthRows = Object.entries(metrics).map(([metric, value]) => ({
      pipeline: "crawl_runner",
      event_type: "metric" as const,
      metric,
      value,
      shard_id: shardId,
      trace_id: traceId,
    }));

    // Add summary state event
    healthRows.push({
      pipeline: "crawl_runner",
      event_type: "state",
      metric: "tick",
      value: 1,
      shard_id: shardId,
      trace_id: traceId,
    });

    await insertHealthEvents(supabase, healthRows.map(r => ({ ...r, payload: healthPayload })));

    return json({
      status: "ok",
      shard_id: shardId,
      batch_id: batchId,
      no_batch_reason: noBatchReason,
      trace_id: traceId,
      mode: crawlMode,
      metrics,
      elapsed_ms: Date.now() - startMs,
    });
  } catch (error: any) {
    console.error("[crawl-runner-tick] Fatal:", error);
    await supabase.from("ingest_errors").insert({
      pipeline: "crawl_runner",
      stage: "tick",
      reason: "fatal_error",
      details_json: { message: error?.message?.slice(0, 500), trace_id: traceId },
    });
    return json({ status: "error", error: error?.message, trace_id: traceId }, 500);
  }
});

// ===== Helpers =====

function elapsed(startMs: number): number {
  return Date.now() - startMs;
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ===== STAGE 1: Website Resolution via resolver worker =====

async function resolveWebsitesViaWorker(supabase: any, traceId: string, limit: number): Promise<number> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/uniranks-website-resolver-worker`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SRV_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ limit, trace_id: traceId }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error("[resolver-call] HTTP error:", r.status, errText);
      return 0;
    }

    const result = await r.json();
    return result?.resolved ?? 0;
  } catch (e: any) {
    console.error("[resolver-call] Error:", e?.message);
    return 0;
  }
}

// ===== Batch Management =====

async function getOrCreateBatch(supabase: any, shardId: number): Promise<string | null> {
  // Find active batch
  const { data: existing } = await supabase
    .from("crawl_batches")
    .select("id")
    .in("status", ["pending", "websites", "discovery", "fetching", "extracting", "verifying"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (existing) return existing.id;

  // Only create batch for universities with resolved official websites
  const { count } = await supabase
    .from("universities")
    .select("id", { head: true, count: "exact" })
    .not("website", "is", null)
    .not("website_etld1", "is", null)
    .in("crawl_status", ["website_resolved", "pending"])
    .eq("is_active", true);

  if (!count || count === 0) return null;

  const { data: batch } = await supabase
    .from("crawl_batches")
    .insert({
      status: "pending",
      universities_count: Math.min(count, 50),
    })
    .select("id")
    .single();

  if (!batch) return null;

  const { data: unis } = await supabase
    .from("universities")
    .select("id")
    .not("website", "is", null)
    .not("website_etld1", "is", null)
    .in("crawl_status", ["website_resolved", "pending"])
    .eq("is_active", true)
    .limit(50);

  if (unis?.length) {
    const batchUnis = unis.map((u: any) => ({
      batch_id: batch.id,
      university_id: u.id,
    }));
    await supabase.from("crawl_batch_universities").insert(batchUnis);

    for (const u of unis) {
      await supabase.from("universities").update({
        crawl_status: "locked",
        crawl_last_attempt: new Date().toISOString(),
      }).eq("id", u.id);
    }
  }

  return batch.id;
}

// ===== STAGE 2: Discover Program URLs =====

async function discoverProgramUrls(supabase: any, batchId: string, limitUnis: number): Promise<number> {
  const { data: unis } = await supabase
    .from("crawl_batch_universities")
    .select("university_id, universities!inner(id, website, website_host, website_etld1, crawl_status)")
    .eq("batch_id", batchId)
    .in("universities.crawl_status", ["website_resolved", "locked"])
    .not("universities.website_etld1", "is", null)
    .limit(limitUnis);

  let discovered = 0;
  for (const row of unis || []) {
    const uni = row.universities;
    if (!uni.website || !uni.website_etld1) continue;

    const officialETLD1 = uni.website_etld1;

    try {
      const urls = await crawlSitemapAndHomepage(uni.website);

      for (const u of urls) {
        try {
          const urlETLD1 = extractETLD1(u.url);
          if (urlETLD1 !== officialETLD1) continue;
        } catch { continue; }

        if (isBlacklisted(u.url)) continue;

        const { data: upsertedId } = await supabase.rpc("rpc_upsert_program_url", {
          p_batch_id: batchId,
          p_university_id: uni.id,
          p_url: u.url,
          p_kind: u.kind,
          p_discovered_from: u.source,
        });
        if (upsertedId && upsertedId > 0) discovered++;
      }

      // PATCH 3: Use discovery_done_official for official discovery
      await supabase.from("universities").update({ crawl_status: "discovery_done_official" }).eq("id", uni.id);
    } catch (e: any) {
      console.error(`Discovery error for ${uni.id}:`, e);
      await supabase.from("universities").update({
        crawl_status: "discovery_error",
        crawl_error: e?.message?.slice(0, 200),
      }).eq("id", uni.id);
    }
  }
  return discovered;
}

function isBlacklisted(url: string): boolean {
  const lower = url.toLowerCase();
  const blocked = [
    "mailto:", "javascript:", "tel:", "#", "cdn-cgi/l/email-protection",
    ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".svg", ".css", ".js",
    ".zip", ".doc", ".docx", ".xls", ".xlsx", ".mp4", ".webp",
  ];
  return blocked.some(b => lower.includes(b));
}

function scoreUrl(url: string): { kind: string; score: number } {
  const lower = url.toLowerCase();
  const keywords: Record<string, { kind: string; weight: number }[]> = {
    program: [{ kind: "program", weight: 3 }],
    degree: [{ kind: "program", weight: 3 }],
    bachelor: [{ kind: "program", weight: 2 }],
    master: [{ kind: "program", weight: 2 }],
    tuition: [{ kind: "fees", weight: 4 }],
    fees: [{ kind: "fees", weight: 3 }],
    "fee-structure": [{ kind: "fees", weight: 4 }],
    admissions: [{ kind: "admissions", weight: 3 }],
    admission: [{ kind: "admissions", weight: 3 }],
    apply: [{ kind: "admissions", weight: 2 }],
    scholarship: [{ kind: "scholarships", weight: 3 }],
    housing: [{ kind: "housing", weight: 3 }],
    accommodation: [{ kind: "housing", weight: 3 }],
    dormitor: [{ kind: "housing", weight: 3 }],
    international: [{ kind: "admissions", weight: 2 }],
    catalog: [{ kind: "catalog", weight: 2 }],
    courses: [{ kind: "catalog", weight: 2 }],
  };

  let bestKind = "unknown";
  let bestScore = 0;
  for (const [kw, entries] of Object.entries(keywords)) {
    if (lower.includes(kw)) {
      for (const e of entries) {
        if (e.weight > bestScore) {
          bestScore = e.weight;
          bestKind = e.kind;
        }
      }
    }
  }
  return { kind: bestKind, score: bestScore };
}

async function crawlSitemapAndHomepage(website: string): Promise<{ url: string; kind: string; source: string }[]> {
  const results: { url: string; kind: string; source: string }[] = [];
  const seen = new Set<string>();

  // Sitemap
  try {
    const origin = new URL(website).origin;
    for (const path of ["/sitemap.xml", "/sitemap_index.xml"]) {
      const r = await fetch(origin + path, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) {
        const xml = await r.text();
        for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/gi)) {
          const u = m[1].trim();
          if (!seen.has(u)) {
            seen.add(u);
            const scored = scoreUrl(u);
            if (scored.score > 0) results.push({ url: u, kind: scored.kind, source: "sitemap" });
          }
        }
        if (results.length > 0) break;
      } else {
        await r.text();
      }
    }
  } catch {}

  // Homepage links
  try {
    const r = await fetch(website, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const html = await r.text();
      const origin = new URL(website).origin;
      for (const m of html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)) {
        let href = m[1];
        if (href.startsWith("/")) href = origin + href;
        if (!href.startsWith("http")) continue;
        if (!seen.has(href)) {
          seen.add(href);
          const scored = scoreUrl(href);
          if (scored.score > 0) results.push({ url: href, kind: scored.kind, source: "homepage" });
        }
      }
    } else {
      await r.text();
    }
  } catch {}

  return results.sort((a, b) => scoreUrl(b.url).score - scoreUrl(a.url).score).slice(0, 200);
}

// ===== STAGE 3: Fetch Pages =====

async function fetchPages(supabase: any, batchId: string, limit: number): Promise<{ fetched: number; failed: number }> {
  const { data: urls, error } = await supabase.rpc("rpc_lock_program_urls_for_fetch", {
    p_batch_id: batchId,
    p_limit: limit,
    p_locked_by: `runner-tick-${Date.now()}`,
  });

  if (error || !urls?.length) return { fetched: 0, failed: 0 };

  const byHost = new Map<string, any>();
  const skipped: any[] = [];
  for (const u of urls) {
    const hostKey = extractHostKey(u.url);
    if (!byHost.has(hostKey)) {
      byHost.set(hostKey, u);
    } else {
      skipped.push(u);
    }
  }

  for (const s of skipped) {
    await supabase.from("program_urls").update({
      locked_at: null, locked_by: null, status: "pending",
    }).eq("id", s.id);
  }

  let fetched = 0, failed = 0;
  for (const [, urlRecord] of byHost) {
    try {
      const result = await fetchSinglePage(supabase, urlRecord);
      if (result.success) {
        await supabase.from("program_urls").update({
          status: "fetched", raw_page_id: result.rawPageId,
          locked_at: null, locked_by: null,
        }).eq("id", urlRecord.id);
        fetched++;
      } else if (result.retry) {
        await supabase.from("program_urls").update({
          status: "retry",
          retry_at: new Date(Date.now() + 2 * 3600_000).toISOString(),
          fetch_error: result.error, locked_at: null, locked_by: null,
        }).eq("id", urlRecord.id);
        failed++;
      } else {
        await supabase.from("program_urls").update({
          status: "failed", fetch_error: result.error,
          locked_at: null, locked_by: null,
        }).eq("id", urlRecord.id);
        failed++;
      }
    } catch (e: any) {
      await supabase.from("program_urls").update({
        status: "failed", fetch_error: e?.message?.slice(0, 200),
        locked_at: null, locked_by: null,
      }).eq("id", urlRecord.id);
      failed++;
    }
  }

  return { fetched, failed };
}

function extractHostKey(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "unknown";
  }
}

async function fetchSinglePage(supabase: any, urlRecord: any): Promise<{ success: boolean; rawPageId?: number; retry?: boolean; error?: string }> {
  try {
    const r = await fetch(urlRecord.url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (r.status === 429 || r.status === 403) {
      const hostKey = extractHostKey(urlRecord.url);
      await supabase.from("crawl_domain_policies").upsert({
        host: hostKey,
        last_429_at: new Date().toISOString(),
      }, { onConflict: "host" });
      return { success: false, retry: true, error: `Rate limited: ${r.status}` };
    }

    if (!r.ok) {
      await r.text();
      return { success: false, retry: false, error: `HTTP ${r.status}` };
    }

    const html = await r.text();
    const text = cleanHtml(html);
    const needsRender = text.length < 2000 && html.length > 5000;
    const hash = await sha256(text);

    const { data: existing } = await supabase
      .from("raw_pages").select("id").eq("url", urlRecord.url).single();

    let rawPageId: number;
    if (existing) {
      const { data } = await supabase.from("raw_pages").update({
        status_code: r.status, fetched_at: new Date().toISOString(),
        body_sha256: hash, text_content: text, needs_render: needsRender,
      }).eq("id", existing.id).select("id").single();
      rawPageId = data?.id;
    } else {
      const { data } = await supabase.from("raw_pages").insert({
        url: urlRecord.url, university_id: urlRecord.university_id,
        status_code: r.status, fetched_at: new Date().toISOString(),
        body_sha256: hash, text_content: text, needs_render: needsRender,
        fetch_attempts: 1,
      }).select("id").single();
      rawPageId = data?.id;
    }

    return { success: true, rawPageId };
  } catch (e: any) {
    if (e?.name === "AbortError") return { success: false, retry: true, error: "Timeout" };
    return { success: false, retry: false, error: e?.message?.slice(0, 200) };
  }
}

function cleanHtml(html: string): string {
  let t = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ");
  t = t.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ");
  t = t.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, " ");
  t = t.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, " ");
  t = t.replace(/<!--[\s\S]*?-->/g, " ");
  t = t.replace(/<[^>]+>/g, " ");
  t = t.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ===== STAGE 4: Extract Programs =====

async function extractPrograms(supabase: any, batchId: string, limit: number): Promise<number> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return 0;

  const { data: urls } = await supabase.rpc("rpc_lock_urls_for_extraction", {
    p_batch_id: batchId,
    p_limit: limit,
  });

  if (!urls?.length) return 0;

  let created = 0;
  for (const rec of urls) {
    if (!rec.text_content) continue;

    try {
      const extracted = await callAI(apiKey, rec.text_content);
      if (!extracted?.program_name) {
        await supabase.from("program_urls").update({ locked_at: null, locked_by: null }).eq("id", rec.url_id);
        continue;
      }

      const contentHash = await sha256(rec.text_content);
      const programKey = await sha256(
        `${rec.url.toLowerCase()}|${(extracted.program_name || "").toLowerCase().trim()}|${(extracted.degree_level || "").toLowerCase().trim()}`
      );

      const { error } = await supabase.from("program_draft").upsert({
        batch_id: batchId,
        university_id: rec.university_id,
        raw_page_id: rec.raw_page_id,
        source_program_url: rec.url,
        title: extracted.program_name,
        degree_level: extracted.degree_level,
        language: extracted.languages?.[0] || null,
        duration_months: parseDuration(extracted.duration),
        currency: extracted.tuition?.currency,
        tuition_fee: extracted.tuition?.amount || null,
        schema_version: "unified_v2",
        program_key: programKey,
        content_hash: contentHash,
        last_extracted_at: new Date().toISOString(),
        extracted_json: extracted,
        field_evidence_map: extracted.evidence || {},
        missing_fields: [],
        flags: [],
        status: "extracted",
      }, { onConflict: "program_key" }).select("id").single();

      if (!error) created++;
      await supabase.from("program_urls").update({
        locked_at: null, locked_by: null, status: "extracted",
      }).eq("id", rec.url_id);
    } catch (e: any) {
      console.error(`Extract error:`, e);
      await supabase.from("program_urls").update({ locked_at: null, locked_by: null }).eq("id", rec.url_id);
    }
  }
  return created;
}

function parseDuration(d: any): number | null {
  if (!d?.value) return null;
  const v = Number(d.value);
  if (!Number.isFinite(v) || v <= 0) return null;
  if (d.unit === "years") return v * 12;
  if (d.unit === "months") return v;
  return null;
}

async function callAI(apiKey: string, text: string): Promise<any> {
  const truncated = text.length > 25000 ? text.slice(0, 25000) + "..." : text;

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Extract university program data as JSON. Fields: program_name, degree_level (bachelor|master|phd|diploma|null), discipline_keywords[], description, duration {value, unit: months|years}, study_mode, languages[], intake_months[1-12], tuition {amount, currency, basis: per_year|per_semester|total, scope: international|domestic|all}, requirements {ielts_overall, toefl, gpa}, scholarship {has_scholarship, type}, evidence {tuition_snippet, duration_snippet, requirements_snippet}, confidence. Only extract what's explicitly stated. null > guess.`,
        },
        { role: "user", content: truncated },
      ],
      temperature: 0.1,
    }),
  });

  if (!r.ok) {
    await r.text();
    return null;
  }
  const result = await r.json();
  const content = result.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    const jsonStr = content.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] || content;
    return JSON.parse(jsonStr.trim());
  } catch {
    return null;
  }
}

// ===== STAGE 5: Verify Drafts =====

async function verifyDrafts(supabase: any, batchId: string, limit: number): Promise<{ auto: number; deep: number }> {
  const { data: drafts } = await supabase
    .from("program_draft")
    .select("id, title, degree_level, language, duration_months, extracted_json, missing_fields")
    .or(`batch_id.eq.${batchId},batch_id.is.null`)
    .eq("status", "extracted")
    .is("approval_tier", null)
    .limit(limit);

  if (!drafts?.length) return { auto: 0, deep: 0 };

  let auto = 0, deep = 0;
  for (const d of drafts) {
    const ext = d.extracted_json || {};
    const flags: string[] = [];
    let tier: "auto" | "quick" | "deep" = "auto";
    let confidence = 0.8;

    if (!d.title || !d.degree_level) { tier = "deep"; flags.push("MISSING_CORE"); confidence -= 0.3; }
    if (!d.duration_months) { tier = "deep"; flags.push("MISSING_DURATION"); confidence -= 0.1; }
    if (!d.language && !ext.languages?.length) { tier = "deep"; flags.push("MISSING_LANGUAGE"); confidence -= 0.1; }

    if (ext.tuition && !ext.tuition.is_free) {
      if (!ext.tuition.basis || ext.tuition.basis === "unknown") { tier = "deep"; flags.push("TUITION_BASIS_UNKNOWN"); confidence -= 0.2; }
      if (!ext.tuition.scope || ext.tuition.scope === "unknown") { tier = "deep"; flags.push("TUITION_SCOPE_UNKNOWN"); confidence -= 0.2; }
      if (!ext.tuition.amount) { tier = "deep"; flags.push("TUITION_MISSING"); confidence -= 0.2; }
    }

    const status = tier === "auto" ? "verified" : "extracted";
    await supabase.from("program_draft").update({
      approval_tier: tier,
      final_confidence: Math.max(0, confidence),
      flags,
      status,
      last_verified_at: new Date().toISOString(),
    }).eq("id", d.id);

    if (tier === "auto") auto++;
    else deep++;
  }
  return { auto, deep };
}

// ===== STAGE 6: Publish Auto-only =====

async function publishAuto(supabase: any, batchId: string): Promise<number> {
  const { count } = await supabase
    .from("program_draft")
    .select("id", { head: true, count: "exact" })
    .or(`batch_id.eq.${batchId},batch_id.is.null`)
    .eq("status", "verified")
    .eq("approval_tier", "auto");

  if (!count || count === 0) return 0;

  const { data, error } = await supabase.rpc("rpc_publish_program_batch_search", {
    p_batch_id: batchId,
  });

  if (error) {
    console.error("[publish] RPC error:", error);
    await supabase.from("ingest_errors").insert({
      pipeline: "crawl_runner", stage: "publish", reason: "rpc_error",
      details_json: { batch_id: batchId, error: error.message },
    });
    return 0;
  }

  return data?.published ?? 0;
}

// ===== Sync Batch Counters =====

async function syncBatchCounters(supabase: any, batchId: string, metrics: Record<string, number>) {
  try {
    const update: Record<string, any> = {};
    if (metrics.programs_extracted !== undefined) update.programs_extracted = (metrics.programs_extracted || 0);
    if (metrics.published !== undefined) update.programs_published = (metrics.published || 0);
    if (metrics.urls_discovered !== undefined || metrics.urls_seeded !== undefined)
      update.programs_discovered = (metrics.urls_discovered || 0) + (metrics.urls_seeded || 0);

    if (Object.keys(update).length > 0) {
      const { data: current } = await supabase.from("crawl_batches").select("programs_discovered, programs_extracted, programs_published").eq("id", batchId).single();
      if (current) {
        if (update.programs_discovered) update.programs_discovered += (current.programs_discovered || 0);
        if (update.programs_extracted) update.programs_extracted += (current.programs_extracted || 0);
        if (update.programs_published) update.programs_published += (current.programs_published || 0);
      }
      await supabase.from("crawl_batches").update(update).eq("id", batchId);
    }
  } catch (e: any) {
    console.warn("[sync-batch-counters] Error:", e?.message);
  }
}

// ===== STAGE 1.5: Seed Program URLs via Seed Worker =====

async function seedProgramUrls(mode: string, traceId: string, policy: any): Promise<number> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!["official", "uniranks", "qs", "hybrid"].includes(mode)) return 0;

  try {
    const limitUnis = policy?.limits?.seed_unis_per_tick ?? 3;
    const maxUrlsPerUni = policy?.limits?.seed_urls_per_tick ?? 50;

    const r = await fetch(`${SUPABASE_URL}/functions/v1/crawl-uniranks-seed-worker`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SRV_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        limit_unis: limitUnis,
        max_urls_per_uni: maxUrlsPerUni,
        mode,
        trace_id: traceId,
      }),
      signal: AbortSignal.timeout(35_000),
    });

    if (!r.ok) { await r.text(); return 0; }
    const result = await r.json();
    return result?.seeded_urls ?? 0;
  } catch (e: any) {
    console.warn("[seed-stage] Non-fatal error (runner continues):", e?.message);
    return 0;
  }
}

// ===== STAGE 1.7: UniRanks Direct Lane =====

async function runUniranksDirectLane(traceId: string, batchId: string | null, limit: number): Promise<number> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 40_000);

    const r = await fetch(`${SUPABASE_URL}/functions/v1/crawl-uniranks-direct-worker`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SRV_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ limit, trace_id: traceId, batch_id: batchId, time_budget_ms: 35_000 }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (!r.ok) { await r.text(); return 0; }
    const result = await r.json();
    return result?.processed ?? 0;
  } catch (e: any) {
    console.error("[uniranks-direct-lane] Error:", e?.message);
    return 0;
  }
}

// ===== Batchless Stage Helpers =====

async function fetchPagesBatchless(supabase: any, limit: number): Promise<{ fetched: number; failed: number }> {
  const { data: urls, error } = await supabase.rpc("rpc_lock_program_urls_for_fetch_batchless", {
    p_limit: limit,
    p_locked_by: `runner-batchless-${Date.now()}`,
  });

  if (error || !urls?.length) return { fetched: 0, failed: 0 };

  const byHost = new Map<string, any>();
  const skipped: any[] = [];
  for (const u of urls) {
    const hostKey = extractHostKey(u.url);
    if (!byHost.has(hostKey)) {
      byHost.set(hostKey, u);
    } else {
      skipped.push(u);
    }
  }

  for (const s of skipped) {
    await supabase.from("program_urls").update({
      locked_at: null, locked_by: null, status: "pending",
    }).eq("id", s.id);
  }

  let fetched = 0, failed = 0;
  for (const [, urlRecord] of byHost) {
    try {
      const result = await fetchSinglePage(supabase, urlRecord);
      if (result.success) {
        await supabase.from("program_urls").update({
          status: "fetched", raw_page_id: result.rawPageId,
          locked_at: null, locked_by: null,
        }).eq("id", urlRecord.id);
        fetched++;
      } else if (result.retry) {
        await supabase.from("program_urls").update({
          status: "retry",
          retry_at: new Date(Date.now() + 2 * 3600_000).toISOString(),
          fetch_error: result.error, locked_at: null, locked_by: null,
        }).eq("id", urlRecord.id);
        failed++;
      } else {
        await supabase.from("program_urls").update({
          status: "failed", fetch_error: result.error,
          locked_at: null, locked_by: null,
        }).eq("id", urlRecord.id);
        failed++;
      }
    } catch (e: any) {
      await supabase.from("program_urls").update({
        status: "failed", fetch_error: e?.message?.slice(0, 200),
        locked_at: null, locked_by: null,
      }).eq("id", urlRecord.id);
      failed++;
    }
  }

  return { fetched, failed };
}

async function extractProgramsBatchless(supabase: any, limit: number): Promise<number> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return 0;

  const { data: urls } = await supabase.rpc("rpc_lock_urls_for_extraction_batchless", {
    p_limit: limit,
    p_locked_by: `runner-batchless-${Date.now()}`,
  });

  if (!urls?.length) return 0;

  let created = 0;
  for (const rec of urls) {
    if (!rec.text_content) continue;

    try {
      const extracted = await callAI(apiKey, rec.text_content);
      if (!extracted?.program_name) {
        await supabase.from("program_urls").update({ locked_at: null, locked_by: null }).eq("id", rec.url_id);
        continue;
      }

      const contentHash = await sha256(rec.text_content);
      const programKey = await sha256(
        `${rec.url.toLowerCase()}|${(extracted.program_name || "").toLowerCase().trim()}|${(extracted.degree_level || "").toLowerCase().trim()}`
      );

      const { error } = await supabase.from("program_draft").upsert({
        batch_id: null,
        university_id: rec.university_id,
        raw_page_id: rec.raw_page_id,
        source_program_url: rec.url,
        title: extracted.program_name,
        degree_level: extracted.degree_level,
        language: extracted.languages?.[0] || null,
        duration_months: parseDuration(extracted.duration),
        currency: extracted.tuition?.currency,
        tuition_fee: extracted.tuition?.amount || null,
        schema_version: "unified_v2",
        program_key: programKey,
        content_hash: contentHash,
        last_extracted_at: new Date().toISOString(),
        extracted_json: extracted,
        field_evidence_map: extracted.evidence || {},
        missing_fields: [],
        flags: [],
        status: "extracted",
      }, { onConflict: "program_key" }).select("id").single();

      if (!error) created++;
      await supabase.from("program_urls").update({
        locked_at: null, locked_by: null, status: "extracted",
      }).eq("id", rec.url_id);
    } catch (e: any) {
      console.error(`[batchless-extract] Error:`, e);
      await supabase.from("program_urls").update({ locked_at: null, locked_by: null }).eq("id", rec.url_id);
    }
  }
  return created;
}

async function verifyDraftsBatchless(supabase: any, limit: number): Promise<{ auto: number; deep: number }> {
  const { data: drafts } = await supabase
    .from("program_draft")
    .select("id, title, degree_level, language, duration_months, extracted_json, missing_fields")
    .is("batch_id", null)
    .eq("status", "extracted")
    .is("approval_tier", null)
    .limit(limit);

  if (!drafts?.length) return { auto: 0, deep: 0 };

  let auto = 0, deep = 0;
  for (const d of drafts) {
    const ext = d.extracted_json || {};
    const flags: string[] = [];
    let tier: "auto" | "quick" | "deep" = "auto";
    let confidence = 0.8;

    if (!d.title || !d.degree_level) { tier = "deep"; flags.push("MISSING_CORE"); confidence -= 0.3; }
    if (!d.duration_months) { tier = "deep"; flags.push("MISSING_DURATION"); confidence -= 0.1; }
    if (!d.language && !ext.languages?.length) { tier = "deep"; flags.push("MISSING_LANGUAGE"); confidence -= 0.1; }

    if (ext.tuition && !ext.tuition.is_free) {
      if (!ext.tuition.basis || ext.tuition.basis === "unknown") { tier = "deep"; flags.push("TUITION_BASIS_UNKNOWN"); confidence -= 0.2; }
      if (!ext.tuition.scope || ext.tuition.scope === "unknown") { tier = "deep"; flags.push("TUITION_SCOPE_UNKNOWN"); confidence -= 0.2; }
      if (!ext.tuition.amount) { tier = "deep"; flags.push("TUITION_MISSING"); confidence -= 0.2; }
    }

    const status = tier === "auto" ? "verified" : "extracted";
    await supabase.from("program_draft").update({
      approval_tier: tier,
      final_confidence: Math.max(0, confidence),
      flags,
      status,
      last_verified_at: new Date().toISOString(),
    }).eq("id", d.id);

    if (tier === "auto") auto++;
    else deep++;
  }
  return { auto, deep };
}

async function publishAutoBatchless(supabase: any, limit: number): Promise<number> {
  const { data, error } = await supabase.rpc("rpc_publish_verified_batchless", {
    p_limit: limit,
  });

  if (error) {
    console.error("[batchless-publish] RPC error:", error);
    await supabase.from("ingest_errors").insert({
      pipeline: "crawl_runner", stage: "publish_batchless", reason: "rpc_error",
      details_json: { error: error.message },
    });
    return 0;
  }

  return data?.published ?? 0;
}

// ===== STAGE 7: Logo Lane =====

async function fetchLogos(supabase: any, traceId: string, limit: number): Promise<number> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/crawl-logo-worker`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SRV_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ limit, trace_id: traceId }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!r.ok) { await r.text(); return 0; }
    const result = await r.json();
    return result?.processed ?? 0;
  } catch (e: any) {
    console.error("[logo-lane] Error:", e?.message);
    return 0;
  }
}

// ===== DOOR 2: Harvest Lane =====

async function runDoor2HarvestLane(supabase: any, traceId: string, batchUniversityIds?: string[]): Promise<number> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    // Check feature flag
    const { data: flagRow } = await supabase
      .from("crawl_settings")
      .select("value")
      .eq("key", "door2_enabled")
      .single();

    if (!flagRow?.value?.enabled) return 0;

    // Check pause
    const { data: configRow } = await supabase
      .from("crawl_settings")
      .select("value")
      .eq("key", "door2_config")
      .single();

    const config = configRow?.value ?? {};
    if (config.pause) return 0;

    const maxUnits = config.max_units_per_tick || 5;
    const lockSeconds = config.lock_seconds ?? 120;

    // === REAPER: Auto-unstick records with expired locks OR orphan no-lock ===
    const now = new Date().toISOString();
    const orphanThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min

    // Case 1: Expired locks (original behavior)
    const { data: expiredLockRows } = await supabase
      .from("uniranks_crawl_state")
      .select("university_id, stage, retry_count, retry_budget")
      .in("stage", ["profile_fetching", "programs_fetching", "details_fetching"])
      .not("locked_until", "is", null)
      .lt("locked_until", now)
      .limit(20);

    // Case 2: Orphan fetching — no lock at all but stale updated_at
    const { data: orphanNoLockRows } = await supabase
      .from("uniranks_crawl_state")
      .select("university_id, stage, retry_count, retry_budget")
      .in("stage", ["profile_fetching", "programs_fetching", "details_fetching"])
      .is("locked_until", null)
      .lt("updated_at", orphanThreshold)
      .limit(20);

    const stuckRows = [...(expiredLockRows || []), ...(orphanNoLockRows || [])];

    for (const stuck of stuckRows) {
      const newRetry = (stuck.retry_count ?? 0) + 1;
      const budget = stuck.retry_budget ?? 3;
      const reason = (orphanNoLockRows || []).some(r => r.university_id === stuck.university_id)
        ? "orphan_fetching_no_lock" : "stuck_reaper_budget_exhausted";

      if (newRetry >= budget) {
        await supabase.from("uniranks_crawl_state").update({
          stage: "quarantined",
          quarantine_reason: reason,
          quarantined_at: now,
          retry_count: newRetry,
          locked_until: null,
          locked_by: null,
          last_error_at: now,
        }).eq("university_id", stuck.university_id);
        console.log(`[door2-reaper] Quarantined ${stuck.university_id} (${reason}) after ${newRetry} retries`);
      } else {
        const pendingStage = stuck.stage.replace("_fetching", "_pending");
        await supabase.from("uniranks_crawl_state").update({
          stage: pendingStage,
          retry_count: newRetry,
          locked_until: null,
          locked_by: null,
          last_error_at: now,
        }).eq("university_id", stuck.university_id);
        console.log(`[door2-reaper] Reset ${stuck.university_id} to ${pendingStage} (${reason}, retry ${newRetry}/${budget})`);
      }

      // Telemetry event
      await supabase.from("pipeline_health_events").insert({
        pipeline: "door2_sequential",
        event_type: "reaper",
        metric: reason,
        value: 1,
        meta: { university_id: stuck.university_id, stage: stuck.stage, retry: newRetry },
      }).then(() => {});
    }

    // Pick candidates — either scoped to batch or global
    let candidates: any[] = [];
    if (batchUniversityIds && batchUniversityIds.length > 0) {
      // Sequential mode: only pick from current batch
      const { data } = await supabase
        .from("uniranks_crawl_state")
        .select("university_id, uniranks_profile_url, stage")
        .in("university_id", batchUniversityIds)
        .in("stage", ["profile_pending", "programs_pending", "details_pending"])
        .or(`locked_until.is.null,locked_until.lt.${now}`)
        .limit(maxUnits);
      candidates = data || [];
    } else {
      // Global mode
      const { data } = await supabase
        .rpc("rpc_pick_door2_candidates", {
          p_max_units: maxUnits,
          p_now: now,
        });
      candidates = data || [];
    }

    if (!candidates.length) return 0;

    let processed = 0;

    for (const c of candidates) {
      // Lock
      const lockUntil = new Date(Date.now() + lockSeconds * 1000).toISOString();
      const { error: lockErr } = await supabase
        .from("uniranks_crawl_state")
        .update({
          locked_until: lockUntil,
          locked_by: `runner-${traceId.slice(-8)}`,
        })
        .eq("university_id", c.university_id)
        .or(`locked_until.is.null,locked_until.lt.${new Date().toISOString()}`);

      if (lockErr) continue;

      // Call harvest worker
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/crawl-uniranks-harvest-worker`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SRV_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            university_id: c.university_id,
            profile_url: c.uniranks_profile_url,
            stage: c.stage,
            trace_id: traceId,
          }),
          signal: AbortSignal.timeout(40_000),
        });

        if (r.ok) {
          const result = await r.json();
          if (result?.ok) processed++;
        } else {
          await r.text().catch(() => {});
        }
      } catch (e: any) {
        console.warn(`[door2-lane] Worker error for ${c.university_id}:`, e?.message);
        await supabase.from("uniranks_crawl_state").update({
          locked_until: null, locked_by: null,
        }).eq("university_id", c.university_id);
      }
    }

    return processed;
  } catch (e: any) {
    console.warn("[door2-lane] Non-fatal:", e?.message);
    return 0;
  }
}

// ===== DOOR 2 Stage 3: Program Detail Extraction =====

async function runDoor2DetailLane(traceId: string, timeBudgetMs: number = 60_000, universityIds?: string[]): Promise<number> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    // Check feature flag
    const supabase = createClient(SUPABASE_URL, SRV_KEY);
    const { data: flagRow } = await supabase
      .from("crawl_settings")
      .select("value")
      .eq("key", "door2_enabled")
      .single();

    if (!flagRow?.value?.enabled) return 0;

    // Check pause
    const { data: configRow } = await supabase
      .from("crawl_settings")
      .select("value")
      .eq("key", "door2_config")
      .single();

    if (configRow?.value?.pause) return 0;

    const detailLimit = configRow?.value?.detail_limit_per_tick ?? 48;

    const bodyPayload: Record<string, any> = {
      limit: detailLimit,
      trace_id: traceId,
      time_budget_ms: timeBudgetMs,
    };
    if (universityIds && universityIds.length > 0) {
      bodyPayload.university_ids = universityIds;
    }

    const r = await fetch(`${SUPABASE_URL}/functions/v1/crawl-door2-program-detail`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SRV_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(Math.min(timeBudgetMs + 10_000, 120_000)),
    });

    if (r.ok) {
      const result = await r.json();
      return result?.processed ?? 0;
    } else {
      await r.text().catch(() => {});
      return 0;
    }
  } catch (e: any) {
    console.warn("[door2-detail-lane] Non-fatal:", e?.message);
    return 0;
  }
}

// ===== QS Harvest Lane (mirrors Door2 harvest but calls crawl-qs-profile-worker) =====
// Uses source-agnostic columns: source_profile_url, entity_type, canonical_university_id

async function runQsHarvestLane(supabase: any, traceId: string, batchUniversityIds?: string[]): Promise<number> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const { data: flagRow } = await supabase
      .from("crawl_settings").select("value").eq("key", "door2_enabled").single();
    if (!flagRow?.value?.enabled) return 0;

    const { data: configRow } = await supabase
      .from("crawl_settings").select("value").eq("key", "door2_config").single();
    const config = configRow?.value ?? {};
    if (config.pause) return 0;

    const maxUnits = config.max_units_per_tick || 5;
    const lockSeconds = config.lock_seconds ?? 120;
    const now = new Date().toISOString();

    // Pick QS candidates using source-agnostic columns ONLY
    let candidates: any[] = [];
    const baseQuery = (q: any) => q
      .from("uniranks_crawl_state")
      .select("university_id, source_profile_url, entity_type, stage")
      .eq("source", "qs")
      .eq("entity_type", "university") // v1: university only
      .eq("stage", "profile_pending")
      .or(`locked_until.is.null,locked_until.lt.${now}`)
      .limit(maxUnits);

    if (batchUniversityIds && batchUniversityIds.length > 0) {
      const { data } = await baseQuery(supabase).in("university_id", batchUniversityIds);
      candidates = data || [];
    } else {
      const { data } = await baseQuery(supabase);
      candidates = data || [];
    }

    if (!candidates.length) return 0;
    let processed = 0;

    for (const c of candidates) {
      // Use source_profile_url ONLY (source-agnostic)
      const profileUrl = c.source_profile_url;
      if (!profileUrl) continue;

      const lockUntil = new Date(Date.now() + lockSeconds * 1000).toISOString();
      await supabase.from("uniranks_crawl_state").update({
        locked_until: lockUntil,
        locked_by: `runner-qs-${traceId.slice(-8)}`,
      }).eq("university_id", c.university_id);

      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/crawl-qs-profile-worker`, {
          method: "POST",
          headers: { Authorization: `Bearer ${SRV_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            university_id: c.university_id,
            source_profile_url: profileUrl,
            entity_type: c.entity_type || "university",
            stage: c.stage,
            trace_id: traceId,
          }),
          signal: AbortSignal.timeout(40_000),
        });
        if (r.ok) {
          const result = await r.json();
          if (result?.ok) processed++;
        } else {
          await r.text().catch(() => {});
        }
      } catch (e: any) {
        console.warn(`[qs-harvest-lane] Worker error for ${c.university_id}:`, e?.message);
        await supabase.from("uniranks_crawl_state").update({
          locked_until: null, locked_by: null,
        }).eq("university_id", c.university_id);
      }
    }
    return processed;
  } catch (e: any) {
    console.warn("[qs-harvest-lane] Non-fatal:", e?.message);
    return 0;
  }
}

// ===== QS Detail Lane (calls crawl-qs-programme-detail) =====

async function runQsDetailLane(traceId: string, timeBudgetMs: number = 60_000, universityIds?: string[]): Promise<number> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const supabase = createClient(SUPABASE_URL, SRV_KEY);
    const { data: flagRow } = await supabase
      .from("crawl_settings").select("value").eq("key", "door2_enabled").single();
    if (!flagRow?.value?.enabled) return 0;

    const { data: configRow } = await supabase
      .from("crawl_settings").select("value").eq("key", "door2_config").single();
    if (configRow?.value?.pause) return 0;

    const detailLimit = configRow?.value?.detail_limit_per_tick ?? 48;
    const bodyPayload: Record<string, any> = {
      limit: detailLimit,
      trace_id: traceId,
      time_budget_ms: timeBudgetMs,
    };
    if (universityIds && universityIds.length > 0) {
      bodyPayload.university_ids = universityIds;
    }

    const r = await fetch(`${SUPABASE_URL}/functions/v1/crawl-qs-programme-detail`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SRV_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(Math.min(timeBudgetMs + 10_000, 120_000)),
    });

    if (r.ok) {
      const result = await r.json();
      return result?.processed ?? 0;
    }
    await r.text().catch(() => {});
    return 0;
  } catch (e: any) {
    console.warn("[qs-detail-lane] Non-fatal:", e?.message);
    return 0;
  }
}
