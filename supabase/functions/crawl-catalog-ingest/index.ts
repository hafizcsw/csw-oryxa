import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflight, getCorsHeaders, generateTraceId, slog } from "../_shared/cors.ts";
import { normalizeUniranksProfileUrl } from "../_shared/url-utils.ts";
import { requireAdmin } from "../_shared/adminGuard.ts";

/**
 * crawl-catalog-ingest: Ingest pages of UniRanks ranking listing.
 * 
 * Patch B: supports `pages_per_call` (default=1, max=5) for batch processing.
 * Response contract (Gatekeeper #3):
 *   trace_id, cursor_key, page_before, page_after, pages_processed, status
 * 
 * Patch C: supports `stride` for shard-based processing.
 */

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin);
  const tid = req.headers.get("x-client-trace-id") || generateTraceId();

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Auth: service_role Bearer, pg_cron (no origin + anon key), or admin JWT
  const authHeader = req.headers.get("Authorization") ?? "";
  const isServiceRole = authHeader === `Bearer ${SRV_KEY}`;
  const isCronCall = !origin && authHeader.startsWith("Bearer ");
  if (!isServiceRole && !isCronCall) {
    const adminCheck = await requireAdmin(req);
    if (!adminCheck.ok) {
      return jsonRes({ ok: false, error: "forbidden", trace_id: tid }, 403, cors);
    }
  }

  const srv = createClient(SUPABASE_URL, SRV_KEY);
  const body = await req.json().catch(() => ({}));
  const cursorKey = body?.key ?? "ranking";
  const pagesPerCall = Math.min(Math.max(body?.pages_per_call ?? 1, 1), 5); // Patch B: 1-5
  const stride = body?.stride ?? 1; // Patch C: stride for sharding

  const startTime = Date.now();
  const TIME_BUDGET_MS = 120_000; // Allow ~4 pages per call

  try {
    // 1) Get cursor
    const { data: row } = await srv
      .from("catalog_ingest_cursor")
      .select("*")
      .eq("key", cursorKey)
      .single();

    if (!row) {
      return jsonRes({ ok: false, error: "no_cursor_row", cursor_key: cursorKey, trace_id: tid }, 404, cors);
    }

    if (row.status === "done") {
      return jsonRes({ ok: true, status: "done", cursor_key: cursorKey, page_before: row.page, page_after: row.page, pages_processed: 0, trace_id: tid }, 200, cors);
    }

    if (row.status === "stopped") {
      return jsonRes({ ok: true, status: "stopped", cursor_key: cursorKey, page_before: row.page, page_after: row.page, pages_processed: 0, trace_id: tid }, 200, cors);
    }

    // Gatekeeper #4: Guard against archived cursors (Patch C safety)
    if (row.status === "archived") {
      return jsonRes({ ok: false, status: "archived", cursor_key: cursorKey, page_before: row.page, page_after: row.page, pages_processed: 0, trace_id: tid }, 409, cors);
    }

    if (row.status === "running") {
      const lastRun = row.last_run_at ? new Date(row.last_run_at).getTime() : 0;
      if (Date.now() - lastRun < 2 * 60_000) {
        return jsonRes({ ok: false, status: "cursor_busy", cursor_key: cursorKey, page_before: row.page, page_after: row.page, pages_processed: 0, trace_id: tid }, 409, cors);
      }
      slog({ tid, level: "warn", action: "stale_lock_recovery", page: row.page, last_run: row.last_run_at });
    }

    const pageBefore = row.page;
    let currentPage = row.page;

    // Mark as running
    await srv.from("catalog_ingest_cursor").update({
      status: "running",
      last_run_at: new Date().toISOString(),
      last_trace_id: tid,
      updated_at: new Date().toISOString(),
    }).eq("key", cursorKey);

    // Patch B: Process multiple pages in one call
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalCatalogUpserts = 0;
    let totalUnisFound = 0;
    let pagesProcessed = 0;
    let consecutiveSkips = 0;
    const MAX_CONSECUTIVE_SKIPS = 3; // Stop after 3 consecutive failures

    for (let p = 0; p < pagesPerCall; p++) {
      // Time budget check (Patch B)
      if (Date.now() - startTime > TIME_BUDGET_MS) {
        slog({ tid, level: "info", action: "time_budget_reached", pages_done: pagesProcessed, elapsed_ms: Date.now() - startTime });
        break;
      }

      // 2) Scrape the page via Firecrawl
      const urlPage = currentPage + 1; // 0-based cursor → 1-based URL
      const pageUrl = `https://www.uniranks.com/ranking/?page=${urlPage}`; // Canonical URL with trailing slash
      slog({ tid, level: "info", action: "catalog_ingest_scrape", page: urlPage, url: pageUrl, batch_index: p });

      // Use connector key only (FIRECRAWL_API_KEY is invalid/expired)
      const apiKey = Deno.env.get("FIRECRAWL_API_KEY_1");
      if (!apiKey) {
        await srv.from("catalog_ingest_cursor").update({ status: "error", updated_at: new Date().toISOString() }).eq("key", cursorKey);
        return jsonRes({ ok: false, error: "missing_firecrawl_key", trace_id: tid, cursor_key: cursorKey, page_before: pageBefore, page_after: currentPage, pages_processed: pagesProcessed }, 500, cors);
      }
      const uniqueKeys = [apiKey];

      // Retry-capable scrape with key rotation and increased wait for Livewire rendering
      const MAX_SCRAPE_RETRIES = 2;
      let scrapeRes: Response | null = null;
      let scrapeData: any = null;
      let scrapeOk = false;

      for (let retry = 0; retry <= MAX_SCRAPE_RETRIES; retry++) {
        const waitMs = 20_000 + (retry * 5_000); // 20s, 25s, 30s
        const timeoutMs = 90_000; // 90s Firecrawl timeout (waitFor must be < 45s)
        const currentKey = uniqueKeys[retry % uniqueKeys.length]; // Rotate keys
        slog({ tid, level: "info", action: "scrape_attempt", page: urlPage, retry, waitFor: waitMs, timeout: timeoutMs, key_index: retry % uniqueKeys.length });

        // Real delay between retries (5s, 10s) to handle rate-limiting
        if (retry > 0) {
          const retryDelay = retry * 5_000;
          slog({ tid, level: "info", action: "retry_delay", page: urlPage, retry, delay_ms: retryDelay });
          await new Promise(r => setTimeout(r, retryDelay));
        }

        try {
          scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${currentKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url: pageUrl,
              formats: ["markdown"],
              onlyMainContent: false,
              waitFor: waitMs,
              timeout: timeoutMs,
            }),
            signal: AbortSignal.timeout(60_000),
          });

          scrapeData = await scrapeRes.json();
        } catch (fetchErr: any) {
          slog({ tid, level: "warn", action: "scrape_fetch_error", page: urlPage, retry, error: fetchErr?.message?.slice(0, 100) });
          continue;
        }

        if (!scrapeRes.ok || !scrapeData.success) {
          const errDetail = scrapeData?.error || scrapeData?.message || JSON.stringify(scrapeData).slice(0, 300);
          slog({ tid, level: "warn", action: "scrape_http_fail", page: urlPage, retry, status: scrapeRes.status, error_detail: errDetail, key_index: retry % uniqueKeys.length });
          continue;
        }

        // Check if we actually got table content (not just shell)
        const testMarkdown = scrapeData.data?.markdown || scrapeData.markdown || "";
        const hasTableContent = testMarkdown.includes("|") && (testMarkdown.match(/\|/g) || []).length > 20;
        if (hasTableContent) {
          scrapeOk = true;
          break;
        }
        slog({ tid, level: "warn", action: "scrape_shell_only", page: urlPage, retry, markdown_len: testMarkdown.length });
      }

      // Handle scrape failure after all retries
      if (!scrapeOk) {
        consecutiveSkips++;
        slog({ tid, level: "warn", action: "all_retries_exhausted", page: urlPage, consecutive_skips: consecutiveSkips });

        // If too many consecutive skips, stop — likely end of catalog or sustained API issue
        if (consecutiveSkips >= MAX_CONSECUTIVE_SKIPS) {
          slog({ tid, level: "warn", action: "max_consecutive_skips_reached", page: urlPage, skips: consecutiveSkips });
          await srv.from("catalog_ingest_cursor").update({
            status: "error",
            meta: { reason: "max_consecutive_skips", last_page: urlPage, consecutive_skips: consecutiveSkips, stopped_at: new Date().toISOString() },
            updated_at: new Date().toISOString(),
          }).eq("key", cursorKey);
          return jsonRes({
            ok: false, status: "error", error: "max_consecutive_skips", trace_id: tid,
            cursor_key: cursorKey, page_before: pageBefore, page_after: currentPage,
            pages_processed: pagesProcessed, consecutive_skips: consecutiveSkips,
          }, 200, cors);
        }

        // AUTO-SKIP: advance cursor past this broken page
        currentPage += stride;
        await srv.from("catalog_ingest_cursor").update({
          page: currentPage,
          status: "pending",
          meta: { skipped_page: urlPage, reason: "scrape_retries_exhausted", skipped_at: new Date().toISOString(), consecutive_skips: consecutiveSkips },
          updated_at: new Date().toISOString(),
        }).eq("key", cursorKey);

        await srv.from("pipeline_health_events").insert({
          pipeline: "catalog_ingest", event_type: "metric", metric: "page_skipped",
          value: urlPage, details_json: { trace_id: tid, key: cursorKey, reason: "retries_exhausted" },
        });
        // Continue to next page in batch if time allows
        continue;
      }

      const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";

      // 3) Parse markdown
      const universities = parseUniversityRows(markdown);

      if (universities.length === 0) {
        // Guard against false "done": save sample for diagnosis
        const markdownSample = markdown.slice(0, 1000);
        const isLikelyError = markdown.toLowerCase().includes("internal error") || markdown.toLowerCase().includes("server error") || markdown.length < 200;
        const isShellOnly = !markdown.includes("|") || (markdown.match(/\|/g) || []).length < 20;

        if (isLikelyError || isShellOnly || pagesProcessed === 0) {
          slog({ tid, level: "warn", action: "parse_empty_or_error_page", page: currentPage, urlPage, markdown_len: markdown.length, sample: markdownSample.slice(0, 200) });

          // AUTO-SKIP instead of stopping: advance and set pending
          currentPage += stride;
          await srv.from("catalog_ingest_cursor").update({
            page: currentPage,
            status: "pending",
            meta: { skipped_page: urlPage, reason: "parse_empty_or_error_page", markdown_sample: markdownSample.slice(0, 500), checked_at: new Date().toISOString() },
            updated_at: new Date().toISOString(),
          }).eq("key", cursorKey);

          await srv.from("pipeline_health_events").insert({
            pipeline: "catalog_ingest", event_type: "metric", metric: "parse_empty_page",
            value: currentPage - stride, details_json: { trace_id: tid, key: cursorKey, page: currentPage - stride, markdown_len: markdown.length, is_error_page: isLikelyError, is_shell_only: isShellOnly },
          });

          // Continue to next page in batch instead of stopping
          continue;
        }

        // Check for "No Record Found" — this is a REAL end
        const hasNoRecord = markdown.toLowerCase().includes("no record found");
        if (hasNoRecord) {
          await srv.from("catalog_ingest_cursor").update({
            status: "done",
            meta: { completed_at: new Date().toISOString(), final_page: currentPage, reason: "no_record_found" },
            updated_at: new Date().toISOString(),
          }).eq("key", cursorKey);

          const { count: catalogTotal } = await srv.from("uniranks_university_catalog").select("*", { count: "exact", head: true });
          const { count: uniTotal } = await srv.from("universities").select("*", { count: "exact", head: true }).not("uniranks_profile_url", "is", null);

          return jsonRes({
            ok: true, status: "done", trace_id: tid, cursor_key: cursorKey,
            page_before: pageBefore, page_after: currentPage, pages_processed: pagesProcessed,
            universities_found: 0, catalog_total: catalogTotal || 0, university_total: uniTotal || 0,
          }, 200, cors);
        }

        // Genuinely empty page after processing some pages = real end
        if (pagesProcessed > 0) {
          await srv.from("catalog_ingest_cursor").update({
            status: "done",
            meta: { completed_at: new Date().toISOString(), final_page: currentPage, reason: "empty_page_after_success", pages_processed_in_batch: pagesProcessed },
            updated_at: new Date().toISOString(),
          }).eq("key", cursorKey);

          const { count: catalogTotal } = await srv.from("uniranks_university_catalog").select("*", { count: "exact", head: true });
          const { count: uniTotal } = await srv.from("universities").select("*", { count: "exact", head: true }).not("uniranks_profile_url", "is", null);

          return jsonRes({
            ok: true, status: "done", trace_id: tid, cursor_key: cursorKey,
            page_before: pageBefore, page_after: currentPage, pages_processed: pagesProcessed,
            universities_found: 0, catalog_total: catalogTotal || 0, university_total: uniTotal || 0,
          }, 200, cors);
        }

        // First page empty but not error — skip and continue
        currentPage += stride;
        await srv.from("catalog_ingest_cursor").update({
          page: currentPage, status: "pending",
          meta: { skipped_page: urlPage, reason: "empty_first_page", checked_at: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        }).eq("key", cursorKey);
        continue;
      }

      // 4) Country lookup (only on first page of batch to avoid repeated queries)
      let countryMap: Map<string, { id: string; code: string }>;
      if (p === 0) {
        countryMap = await buildCountryMap(srv, universities);
        // Store for subsequent pages
        (globalThis as any).__countryMap = countryMap;
      } else {
        countryMap = (globalThis as any).__countryMap || new Map();
      }

      // Upsert universities
      let inserted = 0;
      let updated = 0;
      let catalogUpserts = 0;

      for (const uni of universities) {
        try {
          const { error: catErr } = await srv
            .from("uniranks_university_catalog")
            .upsert({
              uniranks_slug: uni.slug,
              uniranks_profile_url: uni.profileUrl,
              uniranks_name: uni.name,
              country: uni.country || null,
              list_type: cursorKey === "ranking" ? "all" : cursorKey.replace("import_", "").replace(/_s\d+$/, ""),
              rank_position: uni.rank,
              score: uni.score,
              logo_url: uni.logoUrl,
              snapshot_at: new Date().toISOString(),
              last_seen_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: "uniranks_slug" });

          if (!catErr) catalogUpserts++;

          // Upsert into universities
          const { data: existing } = await srv
            .from("universities")
            .select("id, uniranks_rank, uniranks_score, logo_url")
            .eq("uniranks_profile_url", uni.profileUrl)
            .limit(1)
            .single();

          if (existing) {
            const updates: Record<string, any> = {};
            if (uni.rank !== null && existing.uniranks_rank !== uni.rank) updates.uniranks_rank = uni.rank;
            if (uni.score !== null && existing.uniranks_score !== uni.score) updates.uniranks_score = uni.score;
            if (uni.logoUrl && !existing.logo_url) {
              updates.logo_url = uni.logoUrl;
              updates.logo_source = "uniranks_cdn";
            }
            if (Object.keys(updates).length > 0) {
              await srv.from("universities").update(updates).eq("id", existing.id);
              updated++;
            }
            await srv.from("uniranks_university_catalog")
              .update({ match_status: "matched", matched_university_id: existing.id })
              .eq("uniranks_slug", uni.slug);
          } else {
            const { data: bySlug } = await srv
              .from("universities")
              .select("id, logo_url")
              .eq("uniranks_slug", uni.slug)
              .limit(1)
              .single();

            if (bySlug) {
              const updates: Record<string, any> = {
                uniranks_profile_url: uni.profileUrl,
                uniranks_rank: uni.rank,
                uniranks_score: uni.score,
              };
              if (uni.logoUrl && !bySlug.logo_url) {
                updates.logo_url = uni.logoUrl;
                updates.logo_source = "uniranks_cdn";
              }
              await srv.from("universities").update(updates).eq("id", bySlug.id);
              updated++;
              await srv.from("uniranks_university_catalog")
                .update({ match_status: "matched", matched_university_id: bySlug.id })
                .eq("uniranks_slug", uni.slug);
            } else {
              const countryNorm = uni.country ? uni.country.toLowerCase().trim() : null;
              const countryInfo = countryNorm ? countryMap.get(countryNorm) : null;
              const { data: newUni, error: insertErr } = await srv.from("universities").insert({
                name: uni.name,
                name_en: uni.name,
                slug: uni.slug,
                uniranks_slug: uni.slug,
                uniranks_profile_url: uni.profileUrl,
                uniranks_rank: uni.rank,
                uniranks_score: uni.score,
                logo_url: uni.logoUrl || null,
                logo_source: uni.logoUrl ? "uniranks_cdn" : null,
                country_id: countryInfo?.id || null,
                country_code: countryInfo?.code || null,
                crawl_status: "new_from_catalog",
                is_active: false,
              }).select("id").single();

              if (!insertErr && newUni) {
                inserted++;
                await srv.from("uniranks_university_catalog")
                  .update({
                    match_status: countryInfo ? "matched" : "country_unmatched",
                    matched_university_id: newUni.id,
                  })
                  .eq("uniranks_slug", uni.slug);
              }
            }
          }
        } catch (e: any) {
          slog({ tid, level: "warn", action: "uni_upsert_error", uni: uni.name, error: e?.message?.slice(0, 100) });
        }
      }

      totalInserted += inserted;
      totalUpdated += updated;
      totalCatalogUpserts += catalogUpserts;
      totalUnisFound += universities.length;
      pagesProcessed++;
      consecutiveSkips = 0; // Reset on success

      // Advance cursor by stride (Patch C) — update page after EACH page for safety
      // Keep status="running" during batch to maintain lock (Gatekeeper Patch B fix)
      currentPage += stride;
      const existingMeta = (row.meta as any) || {};
      await srv.from("catalog_ingest_cursor").update({
        page: currentPage,
        status: "running",  // Keep running during batch — NOT pending
        last_run_at: new Date().toISOString(),
        last_trace_id: tid,
        meta: { ...existingMeta, last_page_unis: universities.length, inserted, updated, catalog_upserts: catalogUpserts },
        updated_at: new Date().toISOString(),
      }).eq("key", cursorKey);

      // Update import run counters
      if (cursorKey.startsWith("import_")) {
        const runMeta = row.meta as any;
        const runId = runMeta?.run_id;
        if (runId) {
          const { data: runData } = await srv
            .from("uniranks_import_runs")
            .select("pages_done, catalog_upserts, university_upserts, status")
            .eq("id", runId)
            .single();

          if (runData && runData.status === "running") {
            await srv.from("uniranks_import_runs").update({
              pages_done: (runData.pages_done || 0) + 1,
              catalog_upserts: (runData.catalog_upserts || 0) + catalogUpserts,
              university_upserts: (runData.university_upserts || 0) + inserted + updated,
            }).eq("id", runId);
          }
        }
      }

      // Telemetry per page
      await srv.from("pipeline_health_events").insert({
        pipeline: "catalog_ingest",
        event_type: "metric",
        metric: "page_ingested",
        value: universities.length,
        details_json: { trace_id: tid, key: cursorKey, page: currentPage, stride, batch_index: p, inserted, updated, catalog_upserts: catalogUpserts },
      });

      slog({ tid, level: "info", action: "catalog_ingest_page_done", page: currentPage, batch_index: p, found: universities.length, inserted, updated });
    }

    // Release lock: set status back to "pending" ONCE at end of batch (Gatekeeper Patch B fix)
    await srv.from("catalog_ingest_cursor").update({
      status: "pending",
      updated_at: new Date().toISOString(),
    }).eq("key", cursorKey);

    // Get real totals
    const { count: catalogTotal } = await srv.from("uniranks_university_catalog").select("*", { count: "exact", head: true });
    const { count: uniTotal } = await srv.from("universities").select("*", { count: "exact", head: true }).not("uniranks_profile_url", "is", null);

    return jsonRes({
      ok: true,
      trace_id: tid,
      cursor_key: cursorKey,
      page_before: pageBefore,     // Gatekeeper #3
      page_after: currentPage,     // Gatekeeper #3
      page: currentPage,           // backward compat
      pages_processed: pagesProcessed, // Gatekeeper #3
      stride,
      status: "ok",                // Gatekeeper #3
      universities_found: totalUnisFound,
      inserted: totalInserted,
      updated: totalUpdated,
      catalog_upserts: totalCatalogUpserts,
      catalog_total: catalogTotal || 0,
      university_total: uniTotal || 0,
    }, 200, cors);
  } catch (err: any) {
    slog({ tid, level: "error", action: "catalog_ingest_error", error: String(err) });

    const { data: cursorRow } = await srv.from("catalog_ingest_cursor").select("meta").eq("key", cursorKey).single().catch(() => ({ data: null }));
    const preservedMeta = (cursorRow?.meta as any) || {};
    await srv.from("catalog_ingest_cursor").update({
      status: "error",
      meta: { ...preservedMeta, error: err?.message?.slice(0, 200) },
      updated_at: new Date().toISOString(),
    }).eq("key", cursorKey).catch(() => {});

    return jsonRes({ ok: false, error: err?.message, trace_id: tid, cursor_key: cursorKey }, 500, cors);
  }
});

// ===== Country Map Builder =====

async function buildCountryMap(srv: any, universities: ParsedUniversity[]): Promise<Map<string, { id: string; code: string }>> {
  const countryMap = new Map<string, { id: string; code: string }>();
  const uniqueCountries = [...new Set(universities.map((u) => u.country).filter(Boolean))];

  if (uniqueCountries.length > 0) {
    const { data: directMatches } = await srv.from("countries").select("id, name_en, country_code");
    if (directMatches) {
      for (const c of directMatches) {
        if (c.name_en) countryMap.set(c.name_en.toLowerCase().trim(), { id: c.id, code: c.country_code });
      }
    }

    const { data: aliases } = await srv
      .from("country_aliases")
      .select("alias_normalized, country_id, countries:country_id(id, country_code)");
    if (aliases) {
      for (const a of aliases) {
        const co = (a as any).countries;
        if (co && a.alias_normalized) {
          countryMap.set(a.alias_normalized, { id: co.id, code: co.country_code });
        }
      }
    }
  }

  return countryMap;
}

// ===== Parser =====

interface ParsedUniversity {
  name: string;
  slug: string;
  country: string;
  rank: number | null;
  score: number | null;
  profileUrl: string;
  logoUrl: string | null;
}

const UNIRANKS_CDN = "https://d107tomoq7qta0.cloudfront.net/images/universities-logos";

function parseUniversityRows(markdown: string): ParsedUniversity[] {
  const results: ParsedUniversity[] = [];
  const seen = new Set<string>();
  const lines = markdown.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const rankLine = line.match(/Rank\s+(\d+)\s*(?:\\?\|)?\s*Score\s*(\d+(?:\.\d+)?)\s*(?:\\?\|)?\s*Location\s+(.+?)(?:\s*\\?\||\s*$)/i);
    if (!rankLine) continue;

    const rank = parseInt(rankLine[1], 10);
    const score = parseFloat(rankLine[2]);
    const country = rankLine[3].trim().replace(/\s*\\|.*$/, "").trim();

    let name = "";
    let slug = "";
    let profileUrl = "";
    let logoUrl: string | null = null;

    for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
      const linkMatch = lines[j].match(/\[\**([^\\]+?)\**\]\((https?:\/\/(?:www\.)?uniranks\.com\/universities\/([^)\s]+))\)/);
      if (linkMatch) {
        name = linkMatch[1].replace(/\**/g, "").trim();
        profileUrl = linkMatch[2].trim();
        slug = linkMatch[3].replace(/[?#].*$/, "").replace(/\/$/, "");
        break;
      }
    }

    if (!name || !slug || seen.has(slug)) continue;
    seen.add(slug);

    for (let j = i - 1; j >= Math.max(0, i - 8); j--) {
      const logoMatch = lines[j].match(/!\[.*?\]\((https:\/\/d107tomoq7qta0\.cloudfront\.net\/images\/universities-logos\/[^)]+)\)/);
      if (logoMatch) {
        logoUrl = logoMatch[1];
        break;
      }
    }

    if (!logoUrl) {
      logoUrl = `${UNIRANKS_CDN}/${slug}-logo.png`;
    }

    results.push({ name, slug, country, rank, score, profileUrl: normalizeUniranksProfileUrl(profileUrl), logoUrl });
  }

  return results;
}

// ===== Helpers =====

function jsonRes(data: any, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
