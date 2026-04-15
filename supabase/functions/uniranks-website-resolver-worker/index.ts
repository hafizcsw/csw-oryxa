import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractETLD1 } from "../_shared/url-utils.ts";

/**
 * uniranks-website-resolver-worker
 * Uses Firecrawl to render JS-heavy UniRanks profile pages and extract official university websites.
 * Falls back to CWUR profile pages (static HTML via fetch).
 *
 * P3.1: Firecrawl-based resolver for JS-rendered pages.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UA = "LavistaCrawler/1.0 (+https://connectstudyworld.com)";
const FETCH_TIMEOUT_MS = 10_000;
const FIRECRAWL_TIMEOUT_MS = 30_000;

// eTLD+1s to reject outright
const EXCLUDED_ETLD1 = new Set(["uniranks.com"]);

const EXCLUDED_DOMAINS = new Set([
  "uniranks.com", "www.uniranks.com", "uniadmin.uniranks.com",
  "facebook.com", "www.facebook.com",
  "twitter.com", "www.twitter.com", "x.com",
  "instagram.com", "www.instagram.com",
  "linkedin.com", "www.linkedin.com",
  "youtube.com", "www.youtube.com",
  "wikipedia.org", "en.wikipedia.org",
  "google.com", "www.google.com",
  "maps.google.com",
  "cloudflare.com", "cdn-cgi",
  "whersconference.com",
  "cwur.org", "www.cwur.org",
  "whed.net", "www.whed.net",
  "webometrics.info", "www.webometrics.info",
  "timeshighereducation.com",
  "topuniversities.com",
  "shanghairanking.com",
]);

// Asset extensions that must NEVER be stored as website
const ASSET_EXTENSIONS = /\.(webp|png|jpg|jpeg|svg|gif|ico|bmp|tiff|pdf|css|js|woff|woff2|ttf|otf|eot|zip|doc|docx|mp4|mp3|avi|mov)(\?|#|$)/i;

// Patterns that indicate official university websites
const EDU_PATTERNS = [
  /\.edu$/i, /\.edu\./i, /\.ac\./i, /\.university/i,
  /\.uni\./i, /\.univ\./i,
];

// CDN / asset hosting domains to reject
const CDN_DOMAINS = new Set([
  "cloudfront.net", "d107tomoq7qta0.cloudfront.net",
  "cdn.jsdelivr.net", "cdnjs.cloudflare.com",
  "s3.amazonaws.com", "storage.googleapis.com",
  "blob.core.windows.net",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY_1") || Deno.env.get("FIRECRAWL_API_KEY");
  const supabase = createClient(SUPABASE_URL, SRV_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const limit = body.limit ?? 10; // smaller default for Firecrawl cost
    const traceId = body.trace_id ?? `resolver-${Date.now()}`;

    const { data: unis, error: fetchErr } = await supabase
      .from("universities")
      .select("id, uniranks_profile_url, uniranks_slug, name, cwur_profile_url")
      .is("website", null)
      .not("uniranks_profile_url", "is", null)
      .in("crawl_status", ["pending", "websites", "new_from_catalog", "seeded_uniranks", "uniranks_done", "uniranks_no_programs", "uniranks_partial"])
      .order("ranking", { ascending: true, nullsFirst: false })
      .limit(limit);

    if (fetchErr) throw fetchErr;
    if (!unis?.length) {
      return json({ status: "no_work", resolved: 0, trace_id: traceId });
    }

    let resolved = 0;
    let errors = 0;
    const results: any[] = [];

    for (const uni of unis) {
      await supabase.from("universities").update({
        crawl_status: "resolving",
        crawl_last_attempt: new Date().toISOString(),
      }).eq("id", uni.id);

      try {
        // Strategy: Firecrawl for UniRanks (JS-rendered), plain fetch for CWUR (static)
        let candidates: Candidate[] = [];

        if (FIRECRAWL_KEY && uni.uniranks_profile_url) {
          candidates = await extractCandidatesFirecrawl(uni.uniranks_profile_url, FIRECRAWL_KEY);
        }

        // Fallback to CWUR (static HTML, no Firecrawl needed)
        if (candidates.length === 0 && uni.cwur_profile_url) {
          candidates = await extractCandidatesFromStaticPage(uni.cwur_profile_url);
        }

        if (candidates.length === 0) {
          await supabase.from("universities").update({
            crawl_status: "no_official_website",
            crawl_error: "No official domain found via Firecrawl/CWUR",
          }).eq("id", uni.id);

          await supabase.from("ingest_errors").insert({
            pipeline: "website_resolver",
            stage: "resolve",
            reason: "no_candidates",
            details_json: { university_id: uni.id, trace_id: traceId, profile_url: uni.uniranks_profile_url, method: FIRECRAWL_KEY ? "firecrawl" : "static" },
          });

          errors++;
          results.push({ id: uni.id, name: uni.name, status: "no_candidates" });
          continue;
        }

        const best = candidates[0];
        const etld1 = extractETLD1(best.url);
        const { data: rpcResult } = await supabase.rpc("rpc_set_university_website", {
          p_university_id: uni.id,
          p_website: best.url,
          p_source: "firecrawl_uniranks",
          p_etld1: etld1,
          p_confidence: best.score,
        });

        if (rpcResult?.status === "conflict") {
          await supabase.from("universities").update({
            crawl_status: "dedup_conflict",
            crawl_error: `etld1 conflict with ${rpcResult.conflicting_id}`,
          }).eq("id", uni.id);

          errors++;
          results.push({ id: uni.id, name: uni.name, status: "conflict", etld1 });
          continue;
        }

        await supabase.from("university_source_evidence").insert({
          university_id: uni.id,
          field: "website",
          source_urls: [uni.uniranks_profile_url],
          text_snippet: `Firecrawl extracted. Top: ${best.url} (score: ${best.score.toFixed(2)})`,
          data_extracted: { candidates: candidates.slice(0, 5) },
          confidence: best.score,
        }).then(() => {}).catch(() => {});

        resolved++;
        results.push({ id: uni.id, name: uni.name, status: "resolved", website: best.url, etld1 });
      } catch (e: any) {
        await supabase.from("universities").update({
          crawl_status: "website_error",
          crawl_error: e?.message?.slice(0, 200),
        }).eq("id", uni.id);

        errors++;
        results.push({ id: uni.id, name: uni.name, status: "error", error: e?.message?.slice(0, 100) });
      }
    }

    return json({
      status: "ok",
      resolved,
      errors,
      total: unis.length,
      trace_id: traceId,
      results,
    });
  } catch (error: any) {
    console.error("[resolver-worker] Fatal:", error);
    return json({ status: "error", error: error?.message }, 500);
  }
});

// ===== Types =====

interface Candidate {
  url: string;
  host: string;
  etld1: string;
  score: number;
  count: number;
}

// ===== Validation =====

function isValidWebsiteUrl(href: string): boolean {
  if (ASSET_EXTENSIONS.test(href)) return false;
  try {
    const u = new URL(href);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (EXCLUDED_DOMAINS.has(host) || EXCLUDED_DOMAINS.has(u.hostname.toLowerCase())) return false;
    if (host.endsWith("uniranks.com")) return false;
    for (const cdn of CDN_DOMAINS) {
      if (host === cdn || host.endsWith(`.${cdn}`)) return false;
    }
    if (href.includes("mailto:") || href.includes("javascript:")) return false;
    if (host.includes("cdn-cgi") || u.pathname.includes("cdn-cgi")) return false;
    return true;
  } catch {
    return false;
  }
}

// ===== Firecrawl-based extraction (for JS-rendered pages) =====

async function extractCandidatesFirecrawl(profileUrl: string, apiKey: string): Promise<Candidate[]> {
  try {
    const keyPreview = apiKey ? `${apiKey.slice(0, 8)}...` : "NONE";
    console.log(`[resolver] Firecrawl scrape ${profileUrl} key=${keyPreview}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FIRECRAWL_TIMEOUT_MS);

    const r = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: profileUrl,
        formats: ["links", "markdown"],
        waitFor: 5000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!r.ok) {
      const errBody = await r.text().catch(() => "");
      console.error(`[resolver] Firecrawl error ${r.status} for ${profileUrl}: ${errBody.slice(0, 200)}`);
      return [];
    }

    const data = await r.json();
    const links: string[] = data?.data?.links || data?.links || [];
    console.log(`[resolver] Firecrawl returned ${links.length} links for ${profileUrl}. First 5:`, JSON.stringify(links.slice(0, 5)));
    const markdown: string = data?.data?.markdown || data?.markdown || "";

    // Also extract links from markdown text (sometimes contains URLs not in links array)
    const mdLinkRegex = /https?:\/\/[^\s\)"\]]+/gi;
    const mdLinks = markdown.match(mdLinkRegex) || [];
    const allLinks = [...new Set([...links, ...mdLinks])];

    return scoreCandidates(allLinks);
  } catch (e: any) {
    console.error(`[resolver] Firecrawl exception for ${profileUrl}:`, e?.message);
    return [];
  }
}

// ===== Static HTML extraction (for CWUR and other non-JS pages) =====

async function extractCandidatesFromStaticPage(pageUrl: string): Promise<Candidate[]> {
  try {
    const r = await fetch(pageUrl, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!r.ok) return [];
    const html = await r.text();

    const linkRegex = /<a[^>]+href=["']([^"']+)["']/gi;
    const rawLinks: string[] = [];
    for (const m of html.matchAll(linkRegex)) {
      if (m[1].startsWith("http")) rawLinks.push(m[1]);
    }

    return scoreCandidates(rawLinks);
  } catch {
    return [];
  }
}

// ===== Shared scoring logic =====

function scoreCandidates(rawLinks: string[]): Candidate[] {
  const hostCounts = new Map<string, { urls: Set<string>; score: number }>();

  for (const href of rawLinks) {
    if (!isValidWebsiteUrl(href)) continue;
    try {
      const u = new URL(href);
      const host = u.hostname.replace(/^www\./, "").toLowerCase();

      const entry = hostCounts.get(host) || { urls: new Set(), score: 0 };
      entry.urls.add(href);

      let hostScore = 1;
      if (EDU_PATTERNS.some(p => p.test(host))) hostScore += 3;
      if (u.pathname === "/" || u.pathname === "") hostScore += 2;
      if (/univ|college|institut|schol|academ/i.test(host)) hostScore += 1;

      entry.score = Math.max(entry.score, hostScore);
      hostCounts.set(host, entry);
    } catch {
      continue;
    }
  }

  const candidates: Candidate[] = [];
  for (const [host, data] of hostCounts) {
    const combinedScore = data.score * Math.log2(data.urls.size + 1);
    const urls = [...data.urls].sort((a, b) => a.length - b.length);
    const bestUrl = urls[0];

    if (ASSET_EXTENSIONS.test(bestUrl)) continue;

    const etld1 = extractETLD1(bestUrl);
    if (EXCLUDED_ETLD1.has(etld1)) continue;

    candidates.push({
      url: bestUrl,
      host,
      etld1,
      score: Math.min(combinedScore / 10, 1),
      count: data.urls.size,
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, 10);
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
