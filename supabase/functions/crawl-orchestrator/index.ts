import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/adminGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FETCH_TIMEOUT_MS = 15000;
const UA = "LavistaCrawler/1.0 (+https://connectstudyworld.com)";

function generateTraceId(): string {
  return crypto.randomUUID();
}

async function insertIngestError(supabase: any, payload: Record<string, unknown>) {
  // Normalize: always use details_json
  const details = payload.details_json ?? payload.details ?? {};
  const { details: _, ...rest } = payload;
  await supabase.from("ingest_errors").insert({ ...rest, details_json: details });
}

interface BatchRequest {
  action: "create_batch" | "resolve_websites" | "discover_programs" | "get_status";
  size?: number;
  batch_id?: string;
  limit?: number;
  limit_unis?: number;
  filter?: { needs_website?: boolean };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // SECURITY: Require admin authentication
    const adminCheck = await requireAdmin(req);
    if (!adminCheck.ok) {
      return new Response(
        JSON.stringify({ error: adminCheck.error }),
        { status: adminCheck.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const supabase = adminCheck.srv;
    const body: BatchRequest = await req.json();
    console.log(`[crawl-orchestrator] Action: ${body.action}, User: ${adminCheck.user.id}`);

    switch (body.action) {
      case "create_batch":
        return await createBatch(supabase, body);
      case "resolve_websites":
        return await resolveWebsites(supabase, body);
      case "discover_programs":
        return await discoverPrograms(supabase, body);
      case "get_status":
        return await getBatchStatus(supabase, body);
      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: unknown) {
    console.error("[crawl-orchestrator] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function createBatch(supabase: any, body: BatchRequest) {
  const size = body.size || 100;
  const needsWebsite = body.filter?.needs_website ?? true;

  // Use RPC with SKIP LOCKED to prevent race conditions when creating batches
  const workerId = `orchestrator-batch-${Date.now()}`;
  const { data: universities, error: uniError } = await supabase.rpc("rpc_lock_universities_for_batch", {
    p_limit: size,
    p_worker: workerId,
  });

  if (uniError) {
    throw new Error(`Failed to lock universities: ${uniError.message}`);
  }

  if (!universities || universities.length === 0) {
    return new Response(
      JSON.stringify({ batch_id: null, universities_selected: 0, message: "No universities match the filter" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Create batch
  const { data: batch, error: batchError } = await supabase
    .from("crawl_batches")
    .insert({
      status: "pending",
      universities_count: universities.length,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (batchError) {
    throw new Error(`Failed to create batch: ${batchError.message}`);
  }

  // Link universities to batch
  const batchUnis = universities.map((u: any) => ({
    batch_id: batch.id,
    university_id: u.university_id,
  }));

  const { error: linkError } = await supabase
    .from("crawl_batch_universities")
    .insert(batchUnis);

  if (linkError) {
    throw new Error(`Failed to link universities: ${linkError.message}`);
  }

  return new Response(
    JSON.stringify({ batch_id: batch.id, universities_selected: universities.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function resolveWebsites(supabase: any, body: BatchRequest) {
  const batchId = body.batch_id;
  const limit = body.limit || 100;

  if (!batchId) {
    throw new Error("batch_id is required");
  }

  // Use RPC with SKIP LOCKED to prevent race conditions
  const workerId = `orchestrator-resolve-${Date.now()}`;
  const { data: universities, error: fetchError } = await supabase.rpc("rpc_lock_universities_for_website_resolution", {
    p_limit: limit,
    p_worker: workerId,
  });

  if (fetchError) {
    throw new Error(`Failed to lock universities: ${fetchError.message}`);
  }

  let resolved = 0;
  let failed = 0;
  const errors: { university_id: string; reason: string }[] = [];

  for (const uni of universities || []) {
    if (!uni?.cwur_profile_url) continue;

    try {
      const website = await extractOfficialWebsite(uni.cwur_profile_url);
      
      if (website) {
        const { error: updateError } = await supabase
          .from("universities")
          .update({ 
            website,
            crawl_status: "website_resolved",
            crawl_last_attempt: new Date().toISOString()
          })
          .eq("id", uni.university_id);

        if (updateError) {
          errors.push({ university_id: uni.university_id, reason: updateError.message });
          failed++;
        } else {
          resolved++;
        }
      } else {
        const { error: updateError } = await supabase
          .from("universities")
          .update({ 
            crawl_status: "website_not_found",
            crawl_error: "Could not extract official website from CWUR profile",
            crawl_last_attempt: new Date().toISOString()
          })
          .eq("id", uni.university_id);
        
        errors.push({ university_id: uni.university_id, reason: "No official website found in CWUR profile" });
        failed++;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push({ university_id: uni.university_id, reason: message });
      failed++;

      await supabase
        .from("universities")
        .update({ 
          crawl_status: "website_error",
          crawl_error: message,
          crawl_last_attempt: new Date().toISOString()
        })
        .eq("id", uni.university_id);
    }
  }

  // Update batch status
  await supabase
    .from("crawl_batches")
    .update({ 
      status: "websites",
      started_at: new Date().toISOString()
    })
    .eq("id", batchId);

  return new Response(
    JSON.stringify({ resolved, failed, errors }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function extractOfficialWebsite(cwurUrl: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(cwurUrl, {
      headers: { "User-Agent": UA },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`CWUR fetch failed: ${response.status}`);
    }

    const html = await response.text();
    
    // Look for "Official Website" or similar links
    const patterns = [
      /<a[^>]+href=["']([^"']+)["'][^>]*>\s*[^<]*Official\s*Website[^<]*<\/a>/i,
      /<a[^>]+href=["']([^"']+)["'][^>]*>\s*[^<]*University\s*Website[^<]*<\/a>/i,
      /<a[^>]+href=["']([^"']+)["'][^>]*>\s*[^<]*Visit\s*Website[^<]*<\/a>/i,
      // Fallback: allow some markup between the label and the anchor
      /Official\s*Website[\s\S]{0,200}<a[^>]+href=["']([^"']+)["']/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const url = match[1];
        // Validate it's not a CWUR internal link
        if (!url.includes("cwur.org") && url.startsWith("http")) {
          // Validate the URL works
          try {
            const headResponse = await fetch(url, {
              method: "HEAD",
              headers: { "User-Agent": UA },
              signal: AbortSignal.timeout(5000),
            });
            if (headResponse.ok || headResponse.status === 405) {
              return url;
            }
          } catch {
            // Try GET if HEAD fails
            try {
              const getResponse = await fetch(url, {
                headers: { "User-Agent": UA },
                signal: AbortSignal.timeout(5000),
              });
              if (getResponse.ok) {
                return url;
              }
            } catch {
              continue;
            }
          }
        }
      }
    }

    // FIXED: Fallback without TLD filtering - accept ANY external link
    const allLinks = html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi);
    for (const linkMatch of allLinks) {
      const url = linkMatch[1];
      if (url && url.startsWith("http") && !url.includes("cwur.org")) {
        // Accept any external link that's not cwur.org, tracking, or social media
        const skipDomains = ['facebook.com', 'twitter.com', 'linkedin.com', 'instagram.com', 'youtube.com', 'google.com'];
        if (!skipDomains.some(domain => url.includes(domain))) {
          return url;
        }
      }
    }

    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function discoverPrograms(supabase: any, body: BatchRequest) {
  const batchId = body.batch_id;
  const limitUnis = body.limit_unis || 20;

  if (!batchId) {
    throw new Error("batch_id is required");
  }

  // Use RPC with SKIP LOCKED to prevent race conditions
  const workerId = `orchestrator-discover-${Date.now()}`;
  const { data: universities, error: fetchError } = await supabase.rpc("rpc_lock_universities_for_discovery", {
    p_limit: limitUnis,
    p_worker: workerId,
  });

  if (fetchError) {
    throw new Error(`Failed to lock universities: ${fetchError.message}`);
  }

  let urlsDiscovered = 0;
  let seededFromDrafts = 0;
  const byKind: Record<string, number> = { program: 0, fees: 0, admissions: 0, catalog: 0, unknown: 0 };
  const skippedUnis: string[] = [];

  for (const uni of universities || []) {
    if (!uni?.website) {
      skippedUnis.push(uni.university_id);
      continue;
    }

    try {
      // Extract official domain for allowlist filtering
      let officialDomain: string;
      try {
        officialDomain = new URL(uni.website).hostname.replace(/^www\./, "");
      } catch {
        skippedUnis.push(uni.university_id);
        continue;
      }

      const urls = await discoverUniversityUrls(uni.website);
      
      for (const urlInfo of urls) {
          // B1.2: Apply Discovery Hygiene filters
          if (!passesDiscoveryHygiene(urlInfo.url, officialDomain)) {
            continue;
          }

          // Use RPC upsert — RPC handles canonicalization internally
          const { data: upsertedId, error: upsertError } = await supabase.rpc("rpc_upsert_program_url", {
            p_batch_id: batchId,
            p_university_id: uni.university_id,
            p_url: urlInfo.url,
            p_kind: urlInfo.kind,
            p_discovered_from: urlInfo.source,
          });

          if (!upsertError && upsertedId && upsertedId > 0) {
            urlsDiscovered++;
            byKind[urlInfo.kind] = (byKind[urlInfo.kind] || 0) + 1;
          }
      }

      // Update university crawl status
      await supabase
        .from("universities")
        .update({ 
          crawl_status: "discovery_done",
          crawl_stage: 2
        })
        .eq("id", uni.university_id);

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`Failed to discover URLs for ${uni.university_id}:`, error);
      skippedUnis.push(uni.university_id);
      
      await supabase
        .from("universities")
        .update({ 
          crawl_status: "discovery_error",
          crawl_error: message
        })
        .eq("id", uni.university_id);
    }
  }

  // Additional feeder path: seed from existing drafts with missing publish fields
  seededFromDrafts = await seedProgramUrlsFromDrafts(supabase, batchId);
  urlsDiscovered += seededFromDrafts;

  // Update batch status using atomic RPC (no race condition)
  await supabase.rpc("rpc_increment_batch_programs_discovered", {
    p_batch_id: batchId,
    p_delta: urlsDiscovered,
  });
  
  await supabase
    .from("crawl_batches")
    .update({ status: "discovery" })
    .eq("id", batchId);

  return new Response(
    JSON.stringify({ urls_discovered: urlsDiscovered, seeded_from_drafts: seededFromDrafts, by_kind: byKind, skipped_unis: skippedUnis }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

interface DiscoveredUrl {
  url: string;
  kind: "program" | "fees" | "admissions" | "catalog" | "unknown";
  source: string;
  score: number;
}

async function discoverUniversityUrls(websiteUrl: string): Promise<DiscoveredUrl[]> {
  const discovered: DiscoveredUrl[] = [];
  const seen = new Set<string>();
  const baseUrl = new URL(websiteUrl);

  // Try sitemap first
  try {
    const sitemapUrls = await fetchSitemap(baseUrl.origin);
    for (const url of sitemapUrls) {
      if (!seen.has(url)) {
        seen.add(url);
        const scored = scoreUrl(url);
        if (scored.score > 0) {
          discovered.push({ ...scored, source: "sitemap" });
        }
      }
    }
  } catch (e: unknown) {
    console.log("Sitemap fetch failed:", e instanceof Error ? e.message : "Unknown");
  }

  // Try homepage anchors
  try {
    const homepageUrls = await fetchHomepageLinks(websiteUrl, baseUrl.origin);
    for (const url of homepageUrls) {
      if (!seen.has(url)) {
        seen.add(url);
        const scored = scoreUrl(url);
        if (scored.score > 0) {
          discovered.push({ ...scored, source: "homepage" });
        }
      }
    }
  } catch (e: unknown) {
    console.log("Homepage fetch failed:", e instanceof Error ? e.message : "Unknown");
  }

  // Sort by score and limit
  discovered.sort((a, b) => b.score - a.score);
  return discovered.slice(0, 500); // Max 500 per university
}

async function fetchSitemap(origin: string): Promise<string[]> {
  const urls: string[] = [];
  
  const sitemapPaths = ["/sitemap.xml", "/sitemap_index.xml", "/sitemap/sitemap.xml"];
  
  for (const path of sitemapPaths) {
    try {
      const response = await fetch(origin + path, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(10000),
      });
      
      if (response.ok) {
        const xml = await response.text();
        const locMatches = xml.matchAll(/<loc>([^<]+)<\/loc>/gi);
        for (const match of locMatches) {
          urls.push(match[1].trim());
        }
        if (urls.length > 0) break;
      }
    } catch {
      continue;
    }
  }
  
  return urls;
}

async function fetchHomepageLinks(url: string, origin: string): Promise<string[]> {
  const urls: string[] = [];
  
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10000),
    });
    
    if (response.ok) {
      const html = await response.text();
      const linkMatches = html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi);
      
      for (const match of linkMatches) {
        let href = match[1];
        if (href.startsWith("/")) {
          href = origin + href;
        }
        if (href.startsWith(origin)) {
          urls.push(href);
        }
      }
    }
  } catch {
    // Ignore errors
  }
  
  return [...new Set(urls)];
}

// ============= B1.2: Discovery Hygiene Filter =============
function passesDiscoveryHygiene(url: string, officialDomain: string): boolean {
  const lower = url.toLowerCase();

  // Blacklist: reject junk URLs
  const blacklistPatterns = [
    "mailto:",
    "javascript:",
    "cdn-cgi/l/email-protection",
    "tel:",
    "whatsapp:",
    "#",
  ];
  for (const pattern of blacklistPatterns) {
    if (lower.startsWith(pattern) || lower.includes(pattern)) return false;
  }

  // Reject static files (unless program/fee related)
  const staticExtensions = [".jpg", ".jpeg", ".png", ".gif", ".svg", ".ico", ".zip", ".mp4", ".mp3", ".woff", ".woff2", ".ttf", ".css", ".js"];
  for (const ext of staticExtensions) {
    if (lower.endsWith(ext)) return false;
  }

  // Allow PDFs only if they contain program/fee keywords
  if (lower.endsWith(".pdf")) {
    const hasProgramKeyword = /program|fee|tuition|admission|scholarship|prospectus|catalog/i.test(lower);
    if (!hasProgramKeyword) return false;
  }

  // Domain allowlist: only accept URLs within the official domain
  try {
    const urlDomain = new URL(url).hostname.replace(/^www\./, "");
    // Allow exact domain and subdomains
    if (urlDomain !== officialDomain && !urlDomain.endsWith("." + officialDomain)) {
      return false;
    }
  } catch {
    return false;
  }

  // Reject common non-content paths
  const rejectPaths = [
    "/wp-content/uploads/",
    "/wp-includes/",
    "/wp-admin/",
    "/login",
    "/logout",
    "/cart",
    "/checkout",
    "/search?",
  ];
  for (const path of rejectPaths) {
    if (lower.includes(path)) return false;
  }

  return true;
}

function scoreUrl(url: string): { url: string; kind: "program" | "fees" | "admissions" | "catalog" | "unknown"; score: number } {
  const lowerUrl = url.toLowerCase();
  let score = 0;
  let kind: "program" | "fees" | "admissions" | "catalog" | "unknown" = "unknown";

  // Program indicators
  const programPatterns = ["/program", "/course", "/degree", "/study", "/master", "/bachelor", "/phd", "/undergraduate", "/graduate", "/postgraduate"];
  const degreeTokens = ["bachelor", "master", "mba", "msc", "bsc", "phd", "diploma"];
  
  for (const pattern of programPatterns) {
    if (lowerUrl.includes(pattern)) {
      score += 3;
      kind = "program";
    }
  }

  for (const token of degreeTokens) {
    if (lowerUrl.includes(token)) {
      score += 5;
      kind = "program";
    }
  }

  // Fees indicators
  if (lowerUrl.includes("fee") || lowerUrl.includes("tuition") || lowerUrl.includes("cost")) {
    score += 4;
    kind = "fees";
  }

  // Admissions indicators
  if (lowerUrl.includes("admission") || lowerUrl.includes("apply") || lowerUrl.includes("requirement") || lowerUrl.includes("deadline") || lowerUrl.includes("ielts") || lowerUrl.includes("toefl")) {
    score += 4;
    kind = "admissions";
  }

  // Scholarship indicators
  if (lowerUrl.includes("scholarship") || lowerUrl.includes("funding") || lowerUrl.includes("financial-aid") || lowerUrl.includes("financial_aid")) {
    score += 4;
    if (kind === "unknown") kind = "admissions";
  }

  // Catalog indicators
  if (lowerUrl.includes("catalog") || lowerUrl.includes("catalogue") || lowerUrl.includes("prospectus")) {
    score += 3;
    kind = "catalog";
  }

  // Negative indicators
  if (lowerUrl.includes("/news") || lowerUrl.includes("/event") || lowerUrl.includes("/blog")) {
    score -= 5;
  }
  if (lowerUrl.includes("/staff") || lowerUrl.includes("/faculty") || lowerUrl.includes("/contact")) {
    score -= 3;
  }
  if (lowerUrl.endsWith(".pdf") && !lowerUrl.includes("fee") && !lowerUrl.includes("program")) {
    score -= 10;
  }

  return { url, kind: score > 0 ? kind : "unknown", score };
}

function canonicalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove tracking params
    const trackingParams = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"];
    for (const param of trackingParams) {
      parsed.searchParams.delete(param);
    }
    // Lowercase hostname only, keep path case-sensitive
    const lowercaseHost = parsed.hostname.toLowerCase();
    let canonical = `${parsed.protocol}//${lowercaseHost}${parsed.pathname}${parsed.search}`;
    // Remove trailing slash
    if (canonical.endsWith("/")) {
      canonical = canonical.slice(0, -1);
    }
    return canonical;
  } catch {
    return url;
  }
}

async function hashUrl(url: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(url.toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").substring(0, 16);
}

async function getBatchStatus(supabase: any, body: BatchRequest) {
  const batchId = body.batch_id;

  if (!batchId) {
    throw new Error("batch_id is required");
  }

  const { data: batch, error } = await supabase
    .from("crawl_batches")
    .select("*")
    .eq("id", batchId)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch batch: ${error.message}`);

  if (!batch) {
    return new Response(
      JSON.stringify({ error: "BATCH_NOT_FOUND" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get additional stats
  const { count: totalUrls } = await supabase
    .from("program_urls")
    .select("*", { count: "exact", head: true })
    .eq("batch_id", batchId);

  const { count: fetchedUrls } = await supabase
    .from("program_urls")
    .select("*", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .eq("status", "fetched");

  const { count: failedUrls } = await supabase
    .from("program_urls")
    .select("*", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .eq("status", "failed");

  const { count: draftsCount } = await supabase
    .from("program_draft")
    .select("*", { count: "exact", head: true })
    .eq("batch_id", batchId);

  return new Response(
    JSON.stringify({
      ...batch,
      stats: {
        total_urls: totalUrls || 0,
        fetched_urls: fetchedUrls || 0,
        failed_urls: failedUrls || 0,
        drafts_count: draftsCount || 0,
      },
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}


async function seedProgramUrlsFromDrafts(supabase: any, batchId: string): Promise<number> {
  const { data, error } = await supabase.rpc("rpc_seed_program_urls_from_gap", {
    p_batch_id: batchId,
    p_limit: 5000,
  });

  if (error) {
    await insertIngestError(supabase, { pipeline: "crawl_pipeline", batch_id: batchId, entity_hint: "program", stage: "discover", reason: "db_error", details: { error: error.message } });
    return 0;
  }

  return Number(data || 0);
}
