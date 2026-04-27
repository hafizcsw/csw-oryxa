import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  handleCorsPreflight,
  getCorsHeaders,
  generateTraceId,
  slog,
} from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/adminGuard.ts";

// ── Constants ──────────────────────────────────────────────────────────────

const PLANNER_VERSION  = "1c.0";
const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT       = "OrxyaCrawlerBot/2.0 (+https://cswworld.com/bot)";
const MAX_CANDIDATES   = 150;

// Common paths probed when sitemap / anchors yield few results
const COMMON_PATHS: Array<{ path: string; type: CandidateType; priority: number }> = [
  { path: "/programs",                  type: "program_list",  priority: 80 },
  { path: "/programmes",                type: "program_list",  priority: 80 },
  { path: "/academics",                 type: "program_list",  priority: 75 },
  { path: "/courses",                   type: "program_list",  priority: 75 },
  { path: "/undergraduate",             type: "program_list",  priority: 70 },
  { path: "/graduate",                  type: "program_list",  priority: 70 },
  { path: "/postgraduate",              type: "program_list",  priority: 70 },
  { path: "/admissions",                type: "admissions",    priority: 85 },
  { path: "/admission",                 type: "admissions",    priority: 85 },
  { path: "/apply",                     type: "admissions",    priority: 80 },
  { path: "/tuition",                   type: "tuition",       priority: 85 },
  { path: "/tuition-fees",              type: "tuition",       priority: 85 },
  { path: "/fees",                      type: "tuition",       priority: 80 },
  { path: "/cost",                      type: "tuition",       priority: 75 },
  { path: "/scholarships",              type: "scholarship",   priority: 75 },
  { path: "/housing",                   type: "housing",       priority: 75 },
  { path: "/accommodation",             type: "housing",       priority: 75 },
  { path: "/student-life",              type: "about",         priority: 60 },
  { path: "/about",                     type: "about",         priority: 55 },
  { path: "/contact",                   type: "contact",       priority: 55 },
  { path: "/leadership",                type: "leadership",    priority: 55 },
  { path: "/media",                     type: "media",         priority: 50 },
  { path: "/brochure",                  type: "media",         priority: 50 },
  { path: "/sitemap.xml",               type: "sitemap",       priority: 30 },
];

// URL pattern classifiers: first match wins
const TYPE_PATTERNS: Array<{ re: RegExp; type: CandidateType; priority: number }> = [
  { re: /\/(programs?|programmes?|courses?|academics?|undergraduate|graduate|postgraduate)/i, type: "program_list",   priority: 80 },
  { re: /\/(program|programme|course)\/[^/]+/i,                                               type: "program_detail", priority: 75 },
  { re: /\/(admissions?|apply|application|entry.requirements?)/i,                             type: "admissions",     priority: 85 },
  { re: /\/(tuition|fees?|cost|funding|financial.aid)/i,                                      type: "tuition",        priority: 85 },
  { re: /\/(scholarships?|bursaries?|grants?)/i,                                              type: "scholarship",    priority: 75 },
  { re: /\/(housing|accommodation|dormitor|residence)/i,                                      type: "housing",        priority: 75 },
  { re: /\/(leadership|president|rector|chancellor|staff|faculty.directory)/i,                type: "leadership",     priority: 60 },
  { re: /\/(media|brochure|downloads?|publications?|prospectus)/i,                            type: "media",          priority: 55 },
  { re: /\/(about|mission|vision|history|overview)/i,                                         type: "about",          priority: 55 },
  { re: /\/(contact|location|campus.map)/i,                                                   type: "contact",        priority: 50 },
  { re: /sitemap/i,                                                                             type: "sitemap",        priority: 30 },
];

type CandidateType =
  | "homepage" | "program_list" | "program_detail" | "tuition"
  | "admissions" | "housing" | "contact" | "media" | "leadership"
  | "scholarship" | "about" | "sitemap" | "other";

type EventType = "started" | "completed" | "failed" | "warning" | "metric";

// ── JSON response helper ───────────────────────────────────────────────────

function jsonResp(data: unknown, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...getCorsHeaders(origin) },
  });
}

// ── SHA-256 helper ─────────────────────────────────────────────────────────

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Telemetry helper ───────────────────────────────────────────────────────

async function tlog(
  srv: SupabaseClient<any, any, any>,
  p: {
    run_id: string; run_item_id: string; stage: string; event_type: EventType;
    duration_ms?: number; success?: boolean; error_type?: string;
    error_message?: string; metadata?: Record<string, unknown>; trace_id: string;
  },
): Promise<void> {
  await srv.from("crawler_telemetry").insert({
    run_id: p.run_id, run_item_id: p.run_item_id, stage: p.stage,
    event_type: p.event_type, duration_ms: p.duration_ms ?? null,
    success: p.success ?? null, error_type: p.error_type ?? null,
    error_message: p.error_message ?? null,
    metadata: { planner_version: PLANNER_VERSION, ...p.metadata },
    trace_id: p.trace_id,
  });
}

// ── Domain helpers ─────────────────────────────────────────────────────────

function extractHostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function isOfficialDomain(candidateUrl: string, targetDomain: string): boolean {
  const host = extractHostname(candidateUrl);
  if (!host || !targetDomain) return false;
  const td = targetDomain.replace(/^www\./, "");
  return host === td || host.endsWith("." + td);
}

function normalizeUrl(raw: string, base: string): string | null {
  try {
    const u = new URL(raw, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.href.replace(/\/$/, "") || u.href;
  } catch { return null; }
}

function classifyUrl(url: string): { type: CandidateType; priority: number } {
  for (const p of TYPE_PATTERNS) {
    if (p.re.test(url)) return { type: p.type, priority: p.priority };
  }
  return { type: "other", priority: 40 };
}

// ── Parsers ────────────────────────────────────────────────────────────────

function parseAnchors(html: string, base: string): string[] {
  const out: string[] = [];
  const re = /<a\s[^>]*href=["']([^"'#?][^"']*)["'][^>]*>/gi;
  for (const m of html.matchAll(re)) {
    const n = normalizeUrl(m[1], base);
    if (n) out.push(n);
  }
  return [...new Set(out)];
}

function parseSitemapUrls(xml: string, base: string): string[] {
  const out: string[] = [];
  for (const m of xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)) {
    const n = normalizeUrl(m[1].trim(), base);
    if (n) out.push(n);
  }
  return [...new Set(out)];
}

function parseSitemapEntries(robotsTxt: string): string[] {
  const out: string[] = [];
  for (const line of robotsTxt.split("\n")) {
    const m = line.match(/^Sitemap:\s*(.+)/i);
    if (m) out.push(m[1].trim());
  }
  return out;
}

// ── Fetch with timeout ─────────────────────────────────────────────────────

async function fetchWithTimeout(url: string): Promise<{ ok: boolean; status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch {
    return { ok: false, status: 0, text: "" };
  } finally {
    clearTimeout(timer);
  }
}

// ── Main: plan_pages ───────────────────────────────────────────────────────

async function planPages(
  srv: SupabaseClient<any, any, any>,
  runItemId: string,
  tid: string,
): Promise<{ ok: boolean; error?: string; candidates_inserted: number }> {
  const t0 = Date.now();

  // 1. Load run item
  const { data: item, error: itemErr } = await srv
    .from("crawler_run_items")
    .select("id,run_id,university_id,website,target_domain,trace_id,status")
    .eq("id", runItemId)
    .single();

  if (itemErr || !item) {
    return { ok: false, error: "run_item_not_found", candidates_inserted: 0 };
  }

  const runId    = item.run_id    as string;
  const uniId    = item.university_id as string;
  const website  = (item.website  as string | null) ?? "";
  const domain   = (item.target_domain as string | null) ?? extractHostname(website);
  const traceId  = (item.trace_id as string) || tid;
  const baseUrl  = website.replace(/\/$/, "");

  await tlog(srv, {
    run_id: runId, run_item_id: runItemId, stage: "planner", event_type: "started",
    metadata: { website, domain }, trace_id: traceId,
  });

  // 2. Get homepage raw_page (may be null if worker not yet run)
  const { data: rawPage } = await srv
    .from("raw_pages")
    .select("id,text_content,status_code")
    .eq("url", baseUrl)
    .maybeSingle();

  const candidateMap = new Map<string, { type: CandidateType; priority: number; method: string }>();

  // 3. Parse anchors from stored HTML
  if (rawPage?.text_content) {
    const anchors = parseAnchors(rawPage.text_content as string, baseUrl);
    let anchorCount = 0;
    for (const href of anchors) {
      if (isOfficialDomain(href, domain) && !candidateMap.has(href)) {
        const cls = classifyUrl(href);
        candidateMap.set(href, { ...cls, method: "homepage_anchor" });
        anchorCount++;
      }
    }
    await tlog(srv, {
      run_id: runId, run_item_id: runItemId, stage: "planner", event_type: "metric",
      metadata: { phase: "homepage_links_scanned", anchor_count: anchorCount }, trace_id: traceId,
    });
  }

  // 4. robots.txt → sitemap references
  const robotsRes = await fetchWithTimeout(`${baseUrl}/robots.txt`);
  const sitemapUrls: string[] = [];
  if (robotsRes.ok) {
    sitemapUrls.push(...parseSitemapEntries(robotsRes.text));
  }
  sitemapUrls.push(`${baseUrl}/sitemap.xml`, `${baseUrl}/sitemap_index.xml`);

  // 5. Fetch and parse sitemaps
  let sitemapHits = 0;
  for (const sUrl of [...new Set(sitemapUrls)].slice(0, 5)) {
    const res = await fetchWithTimeout(sUrl);
    if (!res.ok) continue;
    const sitemapLinks = parseSitemapUrls(res.text, baseUrl);
    for (const link of sitemapLinks) {
      if (isOfficialDomain(link, domain) && !candidateMap.has(link)) {
        const cls = classifyUrl(link);
        candidateMap.set(link, { ...cls, method: "sitemap_xml" });
        sitemapHits++;
      }
    }
  }
  await tlog(srv, {
    run_id: runId, run_item_id: runItemId, stage: "planner", event_type: "metric",
    metadata: { phase: "sitemap_checked", sitemap_urls_tried: sitemapUrls.length, sitemap_hits: sitemapHits },
    trace_id: traceId,
  });

  // 6. Common paths probe (HEAD only, skip if already discovered)
  for (const cp of COMMON_PATHS) {
    const fullUrl = baseUrl + cp.path;
    if (!candidateMap.has(fullUrl)) {
      candidateMap.set(fullUrl, { type: cp.type, priority: cp.priority, method: "common_path" });
    }
  }

  // 7. Build insert rows (cap at MAX_CANDIDATES, sort by priority desc)
  const rows = [...candidateMap.entries()]
    .map(([url, meta]) => ({
      crawler_run_item_id: runItemId,
      crawler_run_id:      runId,
      university_id:       uniId,
      candidate_url:       url,
      candidate_type:      meta.type,
      discovery_method:    meta.method as "homepage_anchor" | "sitemap_xml" | "robots_txt" | "common_path" | "manual",
      priority:            meta.priority,
      status:              "pending" as const,
      trace_id:            traceId,
    }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_CANDIDATES);

  // 8. Upsert candidates
  let inserted = 0;
  if (rows.length > 0) {
    const { error: upsertErr } = await srv
      .from("crawler_page_candidates")
      .upsert(rows, { onConflict: "crawler_run_item_id,candidate_url", ignoreDuplicates: false });
    if (!upsertErr) inserted = rows.length;
  }

  await tlog(srv, {
    run_id: runId, run_item_id: runItemId, stage: "planner", event_type: "metric",
    metadata: { phase: "candidates_created", candidates_inserted: inserted }, trace_id: traceId,
  });

  // 9. Update run item stage
  await srv.from("crawler_run_items").update({
    stage:            "pages_planned",
    progress_percent: 30,
    pages_found:      inserted,
    updated_at:       new Date().toISOString(),
  }).eq("id", runItemId);

  const durationMs = Date.now() - t0;
  await tlog(srv, {
    run_id: runId, run_item_id: runItemId, stage: "planner", event_type: "completed",
    duration_ms: durationMs, success: true,
    metadata: { candidates_inserted: inserted }, trace_id: traceId,
  });

  return { ok: true, candidates_inserted: inserted };
}

// ── Deno entry ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get("origin");
  const tid    = req.headers.get("x-client-trace-id") || generateTraceId();

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return jsonResp({ ok: false, error: auth.error, trace_id: tid }, auth.status, origin);
  }
  const srv = auth.srv;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResp({ ok: false, error: "invalid_json" }, 400, origin);
  }

  const action = body.action as string | undefined;

  slog({ tid, fn: "crawler-v2-page-planner", action });

  if (action === "plan_pages") {
    const runItemId = body.run_item_id as string | undefined;
    if (!runItemId) return jsonResp({ ok: false, error: "run_item_id required" }, 400, origin);

    const result = await planPages(srv, runItemId, tid);
    return jsonResp({ ...result, tid }, result.ok ? 200 : 422, origin);
  }

  return jsonResp({ ok: false, error: `unknown action: ${action}` }, 400, origin);
});
