import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/adminGuard.ts";
import { sha256Hex } from "../_shared/unifiedExtraction.ts";
import { extractETLD1, normalizeUniranksProfileUrl } from "../_shared/url-utils.ts";

/**
 * crawl-uniranks-direct-worker v4
 *
 * Door 2: Multi-stage per-university extraction with DoD (Definition of Done).
 * Stages: A) Profile Snapshot → B) Website Resolution → C) Logo → D) Programs
 *
 * A university is NOT "done" unless all stages pass or have documented reasons.
 *
 * New in v4:
 *   - Extracts region_label (North America / Europe / Arab World...)
 *   - Extracts verified/recognized/badges/top_buckets/awards
 *   - Calls rpc_upsert_uniranks_signals for structured signal storage
 *   - Strict asset rejection for website URLs
 *   - Per-stage telemetry events
 *   - Honest partial status with missing_fields + block_reason
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-client-trace-id, x-orxya-ingress",
};

const UNIRANKS_CDN = "https://d107tomoq7qta0.cloudfront.net/images/universities-logos";
const EXTRACTOR_VERSION = "uniranks-direct-v4";

// Asset extensions that must NEVER be stored as website
const ASSET_EXTENSIONS = /\.(webp|png|jpg|jpeg|svg|gif|ico|bmp|tiff|pdf|css|js|woff|woff2|ttf|otf|eot|zip|doc|docx|mp4|mp3)(\?|#|$)/i;

// ===== Types =====

interface ParsedProgram {
  title: string;
  degree: string;
  degree_level: string | null;
  study_mode: string;
  language: string;
  tuition_usd: number | null;
  tuition_period: string;
  tuition_raw: string;
  duration_months: number | null;
  duration_raw: string;
  url: string;
  evidence: Record<string, { quote: string; url: string }>;
}

interface UniMetadata {
  about: string | null;
  rank: number | null;
  score: number | null;
  official_website: string | null;
  logo_slug: string | null;
  total_pages: number;
  students_count: number | null;
  acceptance_rate: string | null;
  type: string | null;
  // Door 2 additions
  verified: boolean;
  recognized: boolean;
  country_rank: number | null;
  region_rank: number | null;
  world_rank: number | null;
  region_label: string | null;
  badges: string[];
  top_buckets: string[];
  sections_present: string[];
}

// ===== Parsing =====

function classifyDegreeLevel(raw: string): string | null {
  const l = raw.toLowerCase();
  if (/\bph\.?d|doctor/i.test(l)) return "doctorate";
  if (/\bm\.?[a-z]|master|mba|msc|meng/i.test(l)) return "masters";
  if (/\bb\.?[a-z]|bachelor|bsc|beng|ba\b/i.test(l)) return "bachelors";
  if (/diploma/i.test(l)) return "diploma";
  if (/certificate/i.test(l)) return "certificate";
  if (/associate/i.test(l)) return "associate";
  return null;
}

function parseProgramsFromMarkdown(md: string, sourceUrl: string): ParsedProgram[] {
  const programs: ParsedProgram[] = [];
  const programBlockRegex = /\[([^\]]+?)\]\((https:\/\/www\.uniranks\.com\/universities\/[^)]+)\)/g;
  let match: RegExpExecArray | null;
  const seen = new Set<string>();

  while ((match = programBlockRegex.exec(md)) !== null) {
    const raw = match[1];
    const url = match[2];

    if (raw.trim().length < 10 || /^View\s/i.test(raw.trim())) continue;
    if (url.match(/\/universities\/[^/]+\/?$/)) continue;
    if (seen.has(url)) continue;
    seen.add(url);

    const parts = raw.split(/\\+\n|\\{2,}/).map((p: string) => p.trim()).filter(Boolean);
    if (parts.length < 2) continue;

    const title = parts[0];
    if (title.length < 3 || /^(fees|ranking|#|\[)/i.test(title)) continue;

    const degreeLine = parts[1] || "";
    const degreeMatch = degreeLine.match(
      /^(B\.?[A-Za-z.]+|Bachelor|Master|M\.?[A-Za-z.]+|Ph\.?D\.?|Diploma|Certificate|Associate|MBA|MSc|MEng|BEng|BSc)/i
    );
    const degree = degreeMatch ? degreeMatch[1] : degreeLine.split("/")[0]?.trim() || "";
    const degree_level = classifyDegreeLevel(degree);

    const modeMatch = degreeLine.match(/(?:Full-time|Part-time|Online|On-campus|Blended)/gi);
    const study_mode = modeMatch ? modeMatch.join(", ") : "";

    let language = "English";
    for (const p of parts) {
      if (/language/i.test(p)) {
        const langMatch = p.match(/(?:English|Arabic|French|German|Spanish|Chinese|Japanese|Korean|Turkish)/gi);
        if (langMatch) language = langMatch.join(", ");
      }
    }

    let tuition_raw = "", tuition_usd: number | null = null, tuition_period = "";
    for (const p of parts) {
      const feeMatch = p.match(/([\d,]+(?:\.\d+)?)\s*USD\s*\/\s*(year|semester|month|program)/i);
      if (feeMatch) {
        tuition_raw = p;
        tuition_usd = parseFloat(feeMatch[1].replace(/,/g, ""));
        tuition_period = feeMatch[2].toLowerCase();
        break;
      }
    }

    let duration_raw = "", duration_months: number | null = null;
    for (const p of parts) {
      const durMatch = p.match(/(\d+(?:\.\d+)?)\s*(year|month|semester|week)s?/i);
      if (durMatch) {
        duration_raw = p;
        const val = parseFloat(durMatch[1]);
        const unit = durMatch[2].toLowerCase();
        if (unit === "year") duration_months = Math.round(val * 12);
        else if (unit === "month") duration_months = Math.round(val);
        else if (unit === "semester") duration_months = Math.round(val * 6);
        else if (unit === "week") duration_months = Math.round(val / 4.3);
        break;
      }
    }

    const evidence: Record<string, { quote: string; url: string }> = {};
    evidence["title"] = { quote: title, url: sourceUrl };
    if (degree) evidence["degree"] = { quote: degreeLine, url: sourceUrl };
    if (tuition_raw) evidence["tuition"] = { quote: tuition_raw, url: sourceUrl };
    if (duration_raw) evidence["duration"] = { quote: duration_raw, url: sourceUrl };
    if (study_mode) evidence["study_mode"] = { quote: degreeLine, url: sourceUrl };

    programs.push({
      title, degree, degree_level, study_mode, language,
      tuition_usd, tuition_period, tuition_raw,
      duration_months, duration_raw, url, evidence,
    });
  }
  return programs;
}

function extractMetadata(md: string): UniMetadata {
  let about: string | null = null;
  let rank: number | null = null;
  let score: number | null = null;
  let official_website: string | null = null;
  let students_count: number | null = null;
  let acceptance_rate: string | null = null;
  let type: string | null = null;
  let total_pages = 1;
  let verified = false;
  let recognized = false;
  let country_rank: number | null = null;
  let region_rank: number | null = null;
  let world_rank: number | null = null;
  let region_label: string | null = null;
  const badges: string[] = [];
  const top_buckets: string[] = [];
  const sections_present: string[] = [];

  // About section
  const aboutMatch = md.match(/##\s*About\s+.+?\n\n([\s\S]+?)(?:\n\n\*\s*\*\s*\*|\n##\s|$)/i);
  if (aboutMatch) { about = aboutMatch[1].trim().slice(0, 2000); sections_present.push("about"); }

  // Rank & Score (world rank from header/summary)
  const rankMatch = md.match(/(?:World\s+)?Rank\s*[:#]?\s*(\d+)/i);
  if (rankMatch) {
    const r = parseInt(rankMatch[1], 10);
    if (r > 0 && r < 50000) { rank = r; world_rank = r; }
  }
  const scoreMatch = md.match(/Score\s*[:#]?\s*(\d+(?:\.\d+)?)/i);
  if (scoreMatch) {
    const s = parseFloat(scoreMatch[1]);
    if (s > 0 && s <= 100) score = s;
  }

  // Country rank: "Country Rank: #5" or "#5 in Country"
  const countryRankMatch = md.match(/Country\s+Rank\s*[:#]?\s*#?(\d+)/i)
    || md.match(/#(\d+)\s+in\s+(?:the\s+)?(?:Country|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
  if (countryRankMatch) {
    const cr = parseInt(countryRankMatch[1], 10);
    if (cr > 0 && cr < 50000) country_rank = cr;
  }

  // Region rank + region label: "North America #3" or "Region Rank: #3 (Europe)"
  const regionPatterns = [
    /(?:North America|South America|Europe|Asia|Africa|Oceania|Arab World|Middle East|Latin America|Caribbean)\s*#(\d+)/i,
    /#(\d+)\s+in\s+(North America|South America|Europe|Asia|Africa|Oceania|Arab World|Middle East|Latin America|Caribbean)/i,
    /Region\s+Rank\s*[:#]?\s*#?(\d+)/i,
  ];
  for (const rp of regionPatterns) {
    const rm = md.match(rp);
    if (rm) {
      const rr = parseInt(rm[1], 10);
      if (rr > 0 && rr < 50000) region_rank = rr;
      // Try to extract region label from the match
      if (rm[2]) region_label = rm[2];
      break;
    }
  }
  // Fallback region label extraction from known region names
  if (!region_label) {
    const regionLabelMatch = md.match(/(North America|South America|Europe|Asia|Africa|Oceania|Arab World|Middle East|Latin America|Caribbean)\s*(?:Rank|#\d)/i);
    if (regionLabelMatch) region_label = regionLabelMatch[1];
  }

  // Verified / Recognized
  if (/\bverified\b/i.test(md)) verified = true;
  if (/\brecognized\b/i.test(md)) recognized = true;

  // Badges and awards: "Platinum Award", "Gold Award", "Top-World", etc.
  // Canonical badge values (lowercase): platinum_award, gold_award, silver_award, bronze_award, 
  //   top_world, top_country, top_region, elite, award_of_excellence
  const BADGE_CANONICAL: Record<string, string> = {
    "platinum award": "platinum_award", "gold award": "gold_award",
    "silver award": "silver_award", "bronze award": "bronze_award",
    "top-world": "top_world", "top world": "top_world",
    "top-country": "top_country", "top country": "top_country",
    "top-region": "top_region", "top region": "top_region",
    "elite": "elite", "award of excellence": "award_of_excellence",
    "award-of-excellence": "award_of_excellence",
  };
  const badgePatterns = [
    /\b(Platinum|Gold|Silver|Bronze)\s+Award\b/gi,
    /\b(Top[\s-]World|Top[\s-]Country|Top[\s-]Region|Elite)\b/gi,
    /\bAward[\s-](?:of\s+)?Excellence\b/gi,
  ];
  const badgeSet = new Set<string>();
  for (const bp of badgePatterns) {
    for (const bm of md.matchAll(bp)) {
      const raw = bm[0].trim().toLowerCase().replace(/\s+/g, " ");
      const canonical = BADGE_CANONICAL[raw] || BADGE_CANONICAL[raw.replace(/-/g, " ")] || raw.replace(/\s+/g, "_");
      badgeSet.add(canonical);
    }
  }
  badges.push(...badgeSet);

  // Top buckets: canonical format "top_100", "top_500", "top_1000", "elite"
  const bucketSet = new Set<string>();
  const bucketPatterns = /\bTop[\s-](\d+)\b/gi;
  for (const bm of md.matchAll(bucketPatterns)) {
    bucketSet.add(`top_${bm[1]}`);
  }
  if (/\bElite\b/i.test(md)) bucketSet.add("elite");
  top_buckets.push(...bucketSet);

  // Official website — strict: must be a real domain, not an asset
  // Strategy: UniRanks profiles often don't have explicit "Website: url" text.
  // We look for: 1) explicit patterns, 2) any external non-social, non-uniranks link
  const websitePatterns = [
    /(?:Official\s+)?Website\s*[:#]?\s*\[?\s*(https?:\/\/[^\]\s\n)]+)/i,
    /\[(?:Official\s+)?Website\]\((https?:\/\/[^)]+)\)/i,
    /\[Visit\s+(?:Official\s+)?(?:Website|Site)\]\((https?:\/\/[^)]+)\)/i,
    /(?:Official\s+)?(?:Website|Site|Homepage)\s*[:#]?\s*\[([^\]]+)\]\((https?:\/\/[^)]+)\)/i,
    /(?:Official\s+)?(?:Website|Site|Homepage)\s*[:#]?\s*(https?:\/\/[^\s\n]+)/i,
  ];
  for (const wp of websitePatterns) {
    const wsm = md.match(wp);
    if (!wsm) continue;
    const rawUrl = (wsm[wsm.length === 3 ? 2 : 1] || "").replace(/[)\]]/g, "").trim();
    if (!rawUrl) continue;
    if (ASSET_EXTENSIONS.test(rawUrl)) continue;
    if (/uniranks\.com/i.test(rawUrl)) continue;
    const hasDomain = /^https?:\/\/[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z]{2,})+/i.test(rawUrl);
    if (hasDomain) {
      official_website = rawUrl;
      sections_present.push("website");
      break;
    }
  }

  // Fallback: scan all markdown links for external .edu/.ac domains (highest signal)
  if (!official_website) {
    const EXCLUDED_HOSTS_MD = new Set([
      "facebook.com","twitter.com","x.com","instagram.com","linkedin.com",
      "youtube.com","wikipedia.org","en.wikipedia.org","google.com","maps.google.com",
      "whersconference.com","cwur.org","whed.net","webometrics.info",
      "timeshighereducation.com","topuniversities.com","shanghairanking.com",
      "cloudflare.com","cloudfront.net","d107tomoq7qta0.cloudfront.net",
    ]);
    const linkRegex = /\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;
    const eduCandidates: { url: string; score: number }[] = [];
    for (const lm of md.matchAll(linkRegex)) {
      const href = lm[2].replace(/[)\]]/g, "").trim();
      if (ASSET_EXTENSIONS.test(href)) continue;
      if (/uniranks\.com/i.test(href)) continue;
      try {
        const u = new URL(href);
        const host = u.hostname.replace(/^www\./, "").toLowerCase();
        if (EXCLUDED_HOSTS_MD.has(host) || EXCLUDED_HOSTS_MD.has(u.hostname.toLowerCase())) continue;
        if (host.includes("cloudfront") || host.includes("cdn-cgi") || host.includes("cdn.")) continue;
        // Score .edu/.ac domains highest
        let s = 0;
        if (/\.edu(\.|$)/i.test(host)) s += 10;
        if (/\.ac\./i.test(host)) s += 10;
        if (/\.university|\.uni\.|\.univ\./i.test(host)) s += 5;
        if (u.pathname === "/" || u.pathname === "") s += 3;
        if (s > 0) eduCandidates.push({ url: href, score: s });
      } catch { /* skip */ }
    }
    if (eduCandidates.length) {
      eduCandidates.sort((a, b) => b.score - a.score);
      official_website = eduCandidates[0].url;
      sections_present.push("website");
    }
  }

  // Students
  const studentsMatch = md.match(/(\d[\d,]+)\s*(?:total\s+)?students/i);
  if (studentsMatch) { students_count = parseInt(studentsMatch[1].replace(/,/g, ""), 10); sections_present.push("students"); }

  // Acceptance rate
  const acceptMatch = md.match(/(?:Acceptance|Admission)\s+Rate\s*[:#]?\s*([\d.]+%)/i);
  if (acceptMatch) { acceptance_rate = acceptMatch[1]; sections_present.push("acceptance_rate"); }

  // Type
  const typeMatch = md.match(/(?:Type|Institution)\s*[:#]?\s*(Public|Private|Non-profit|For-profit)/i);
  if (typeMatch) { type = typeMatch[1]; sections_present.push("type"); }

  // Detect other sections
  if (/##?\s*(?:Fees|Tuition)/i.test(md)) sections_present.push("fees");
  if (/##?\s*(?:Programs|Courses|Degrees)/i.test(md)) sections_present.push("programs");
  if (/##?\s*(?:International|Foreign)/i.test(md)) sections_present.push("international");
  if (/##?\s*(?:Staff|Faculty)/i.test(md)) sections_present.push("staff");
  if (/##?\s*(?:Ranking|Rankings)/i.test(md)) sections_present.push("rankings");
  if (rank) sections_present.push("rank");
  if (score) sections_present.push("score");
  if (verified) sections_present.push("verified");
  if (recognized) sections_present.push("recognized");
  if (badges.length) sections_present.push("badges");

  // Pagination
  const pagMatch = md.match(/Page\s+(\d+)\s+of\s+(\d+)/i);
  if (pagMatch) total_pages = parseInt(pagMatch[2], 10);

  const logoSlug = md.match(/universities-logos\/([a-z0-9-]+)-logo/i)?.[1] || null;

  return {
    about, rank, score, official_website, logo_slug: logoSlug, total_pages,
    students_count, acceptance_rate, type,
    verified, recognized, country_rank, region_rank, world_rank,
    region_label, badges, top_buckets, sections_present,
  };
}

// ===== Firecrawl =====

async function scrapePage(apiKey: string, url: string): Promise<{ markdown: string; ok: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000); // Hard 30s cap per request

    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true, waitFor: 15_000 }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const data = await res.json();
    if (!res.ok || !data.success) return { markdown: "", ok: false, error: data?.error || `HTTP ${res.status}` };
    const md = data.data?.markdown || data.markdown || "";
    if (/loading\s+programs|loading\s+fees/i.test(md) && md.length < 500) {
      return { markdown: md, ok: false, error: "js_not_loaded" };
    }
    return { markdown: md, ok: true };
  } catch (e: any) {
    const msg = e?.message?.slice(0, 100) || "unknown";
    const isTimeout = msg.includes("abort") || msg.includes("timeout") || msg.includes("signal");
    return { markdown: "", ok: false, error: isTimeout ? "request_timeout_30s" : msg };
  }
}

async function scrapePageViaActions(
  apiKey: string,
  profileUrl: string,
  targetPage: number,
): Promise<{ markdown: string; ok: boolean }> {
  const clickCount = targetPage - 1;
  const estimatedTime = 12000 + (clickCount * 8000) + 5000;
  if (estimatedTime > 80000) return { markdown: "", ok: false };

  // Use executeJavascript to call Livewire's internal nextPage() method
  // This is the only reliable way to paginate UniRanks Livewire v3 pages
  const actions: any[] = [{ type: "wait", milliseconds: 12000 }];
  for (let i = 0; i < clickCount; i++) {
    actions.push({
      type: "executeJavascript",
      script: `
        try {
          const components = Object.values(window.Livewire?.all?.() || {});
          const paginated = components.find(c => c?.snapshot && JSON.stringify(c.snapshot).includes('page'));
          if (paginated) { paginated.call('nextPage'); }
          else {
            const btn = document.querySelector("button[wire\\\\:click*='nextPage'], nav[role='navigation'] button:last-child, .pagination button:last-child");
            if (btn) btn.click();
          }
        } catch(e) { console.log('pagination-error', e); }
      `,
    });
    actions.push({ type: "wait", milliseconds: 8000 });
  }
  actions.push({ type: "scrape" });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35_000); // Cap pagination at 35s

    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: profileUrl, formats: ["markdown"], onlyMainContent: true, actions }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    if (!res.ok || !data.success) {
      console.log(`[scrapeViaActions] page ${targetPage} API error:`, data?.error || res.status);
      return { markdown: "", ok: false };
    }

    const results = data.data?.actions_results || [];
    let md = "";
    for (const r of results) {
      if (r?.markdown) md = r.markdown;
    }
    if (!md) md = data.data?.markdown || data.markdown || "";
    return { markdown: md, ok: md.length > 100 };
  } catch (e: any) {
    console.log(`[scrapeViaActions] page ${targetPage} exception:`, e?.message?.slice(0, 100));
    return { markdown: "", ok: false };
  }
}

// ===== Persistence =====

async function persistPrograms(
  supabase: any,
  uniId: string,
  uniSlug: string,
  programs: ParsedProgram[],
  traceId: string,
  contentHash: string,
): Promise<{ saved: number; skipped: number; errors: string[] }> {
  let saved = 0, skipped = 0;
  const errors: string[] = [];

  for (const prog of programs) {
    try {
      const programKey = await sha256Hex(
        `${prog.url}|${uniId}|${(prog.degree || "").toLowerCase()}|${prog.title.toLowerCase().trim()}`
      );

      const currency = prog.tuition_usd ? "USD" : null;
      const tuitionBasis = prog.tuition_period === "year" ? "per_year"
        : prog.tuition_period === "semester" ? "per_semester"
        : prog.tuition_period === "month" ? "per_month"
        : prog.tuition_period === "program" ? "total"
        : null;

      const { error } = await supabase.from("program_draft").upsert({
        university_id: uniId,
        university_name: uniSlug,
        program_key: programKey,
        title: prog.title,
        degree_level: prog.degree || null,
        language: prog.language || "English",
        duration_months: prog.duration_months,
        tuition_fee: prog.tuition_usd,
        currency: currency,
        source_program_url: prog.url,
        source_url: prog.url,
        content_hash: contentHash,
        status: "pending",
        schema_version: "unified_v2",
        extractor_version: EXTRACTOR_VERSION,
        last_extracted_at: new Date().toISOString(),
        extracted_json: {
          title: prog.title,
          degree: { raw: prog.degree, level: prog.degree_level },
          study_mode: prog.study_mode,
          tuition: { usd_min: prog.tuition_usd, usd_max: prog.tuition_usd, basis: tuitionBasis, currency },
          duration: { months: prog.duration_months },
          languages: [prog.language || "English"],
          source: "uniranks",
          trace_id: traceId,
        },
        field_evidence_map: prog.evidence,
      }, { onConflict: "program_key" }).select("id");

      if (error) {
        if (error.code === "23505") { skipped++; continue; }
        errors.push(`${prog.title.slice(0, 30)}: ${error.message?.slice(0, 60)}`);
      } else {
        saved++;
      }
    } catch (e: any) {
      errors.push(`${prog.title.slice(0, 30)}: ${e?.message?.slice(0, 60)}`);
    }
  }
  return { saved, skipped, errors };
}

/**
 * Stage A: Store profile signals via RPC (structured columns + snapshot)
 */
async function stageA_ProfileSnapshot(
  supabase: any,
  uniId: string,
  meta: UniMetadata,
  markdown: string,
  traceId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const signals: Record<string, any> = {};
    if (meta.verified) signals.uniranks_verified = true;
    if (meta.recognized) signals.uniranks_recognized = true;
    if (meta.world_rank) signals.uniranks_world_rank = meta.world_rank;
    if (meta.country_rank) signals.uniranks_country_rank = meta.country_rank;
    if (meta.region_rank) signals.uniranks_region_rank = meta.region_rank;
    if (meta.region_label) signals.uniranks_region_label = meta.region_label;
    if (meta.badges.length) signals.uniranks_badges = meta.badges;
    if (meta.top_buckets.length) signals.uniranks_top_buckets = meta.top_buckets;
    signals.uniranks_data_quality = "raw";

    // Build snapshot from full metadata
    const snapshot = {
      about: meta.about?.slice(0, 2000),
      rank: meta.rank,
      score: meta.score,
      students_count: meta.students_count,
      acceptance_rate: meta.acceptance_rate,
      type: meta.type,
      official_website: meta.official_website,
      country_rank: meta.country_rank,
      region_rank: meta.region_rank,
      region_label: meta.region_label,
      world_rank: meta.world_rank,
      verified: meta.verified,
      recognized: meta.recognized,
      badges: meta.badges,
      top_buckets: meta.top_buckets,
      scraped_at: new Date().toISOString(),
      extractor: EXTRACTOR_VERSION,
    };

    const { data, error } = await supabase.rpc("rpc_upsert_uniranks_signals", {
      p_university_id: uniId,
      p_trace_id: traceId,
      p_signals: signals,
      p_snapshot: snapshot,
      p_sections_present: meta.sections_present,
    });

    if (error) return { ok: false, error: error.message };
    return { ok: data?.ok === true };
  } catch (e: any) {
    return { ok: false, error: e?.message?.slice(0, 100) };
  }
}

/**
 * Stage B: Resolve official website (with strict asset rejection)
 * Uses two strategies:
 * 1. Markdown metadata (rare — UniRanks usually doesn't expose website in markdown)
 * 2. Raw HTML fetch fallback — scans <a> tags for .edu/.ac links (same as website-resolver-worker)
 */
async function stageB_WebsiteResolver(
  supabase: any,
  uniId: string,
  meta: UniMetadata,
  currentWebsite: string | null,
  profileUrl: string,
): Promise<{ resolved: boolean; website: string | null; reason?: string }> {
  if (currentWebsite) return { resolved: true, website: currentWebsite, reason: "already_set" };

  let candidateUrl = meta.official_website;

  // Fallback: fetch raw HTML and extract external links (like website-resolver-worker)
  if (!candidateUrl && profileUrl) {
    try {
      const r = await fetch(profileUrl, {
        headers: { "User-Agent": "LavistaCrawler/1.0 (+https://connectstudyworld.com)" },
        redirect: "follow",
        signal: AbortSignal.timeout(10_000),
      });
      if (r.ok) {
        const html = await r.text();
        candidateUrl = extractBestWebsiteFromHtml(html);
      }
    } catch { /* timeout/network error — skip */ }
  }

  if (!candidateUrl) return { resolved: false, website: null, reason: "not_found_in_profile_or_html" };

  // Final asset guard
  if (ASSET_EXTENSIONS.test(candidateUrl)) {
    return { resolved: false, website: null, reason: `rejected_asset:${candidateUrl}` };
  }
  if (/uniranks\.com/i.test(candidateUrl)) {
    return { resolved: false, website: null, reason: "rejected_uniranks_domain" };
  }

  // Use RPC (not direct UPDATE) — respects etld1 dedup + audit
  const etld1 = extractETLD1(candidateUrl);
  const { data, error } = await supabase.rpc("rpc_set_university_website", {
    p_university_id: uniId,
    p_website: candidateUrl,
    p_source: "uniranks_direct_v4",
    p_etld1: etld1,
    p_confidence: 0.7,
  });

  if (error) return { resolved: false, website: null, reason: `rpc_error:${error.message?.slice(0, 80)}` };
  if (data?.status === "conflict") return { resolved: false, website: null, reason: `etld1_conflict:${data.conflicting_id}` };

  return { resolved: true, website: candidateUrl };
}

/**
 * Extract best official website URL from raw HTML <a> tags.
 * Mirrors logic from uniranks-website-resolver-worker but simplified.
 */
function extractBestWebsiteFromHtml(html: string): string | null {
  const EXCLUDED_HOSTS = new Set([
    "uniranks.com", "www.uniranks.com", "uniadmin.uniranks.com",
    "facebook.com", "www.facebook.com", "twitter.com", "www.twitter.com", "x.com",
    "instagram.com", "www.instagram.com", "linkedin.com", "www.linkedin.com",
    "youtube.com", "www.youtube.com", "wikipedia.org", "en.wikipedia.org",
    "google.com", "www.google.com", "maps.google.com",
    "cloudflare.com", "cloudfront.net", "d107tomoq7qta0.cloudfront.net",
    "whersconference.com", "www.whersconference.com",
    "cwur.org", "www.cwur.org", "whed.net", "www.whed.net",
    "webometrics.info", "www.webometrics.info",
    "timeshighereducation.com", "topuniversities.com", "shanghairanking.com",
  ]);
  const EDU_PATTERNS = [/\.edu$/i, /\.edu\./i, /\.ac\./i, /\.university/i, /\.uni\./i];

  const linkRegex = /<a[^>]+href=["']([^"']+)["']/gi;
  const candidates: { url: string; score: number }[] = [];

  for (const m of html.matchAll(linkRegex)) {
    const href = m[1];
    if (!href.startsWith("http")) continue;
    if (ASSET_EXTENSIONS.test(href)) continue;
    try {
      const u = new URL(href);
      const host = u.hostname.replace(/^www\./, "").toLowerCase();
      if (EXCLUDED_HOSTS.has(host) || EXCLUDED_HOSTS.has(u.hostname.toLowerCase())) continue;
      if (host.endsWith("uniranks.com")) continue;
      if (host.includes("cdn") || host.includes("cloudfront")) continue;

      let score = 1;
      if (EDU_PATTERNS.some(p => p.test(host))) score += 10;
      if (u.pathname === "/" || u.pathname === "") score += 3;
      if (/univ|college|institut|schol|academ/i.test(host)) score += 2;

      candidates.push({ url: href, score });
    } catch { continue; }
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].url;
}

/**
 * Stage C: Logo resolution
 */
async function stageC_Logo(
  supabase: any,
  uniId: string,
  uniSlug: string,
  currentLogoUrl: string | null,
): Promise<boolean> {
  if (currentLogoUrl) return false;
  const logoUrl = `${UNIRANKS_CDN}/${uniSlug}-logo.png`;
  try {
    const headRes = await fetch(logoUrl, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    if (!headRes.ok) return false;

    const r = await fetch(logoUrl, { signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return false;

    const blob = await r.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const hash = await sha256Hex(new TextDecoder().decode(bytes).slice(0, 1000));
    const fileName = `${uniSlug}-${hash.slice(0, 8)}.png`;

    const { error: uploadErr } = await supabase.storage
      .from("university-logos")
      .upload(fileName, bytes, { contentType: "image/png", upsert: true });
    if (uploadErr) return false;

    const { data: urlData } = supabase.storage.from("university-logos").getPublicUrl(fileName);
    if (!urlData?.publicUrl) return false;

    await supabase.rpc("rpc_set_university_logo", {
      p_university_id: uniId,
      p_logo_url: urlData.publicUrl,
      p_source: "uniranks_cdn",
    });
    return true;
  } catch {
    return false;
  }
}

// ===== Completeness Gate =====

function assessCompleteness(
  meta: UniMetadata,
  programCount: number,
  pagesDone: number,
  logoSaved: boolean,
  currentLogoUrl: string | null,
  websiteResolved: boolean,
  blockReason?: string,
): { status: string; score: number; missing: string[]; optional_missing: string[]; block_reason?: string } {
  const missing: string[] = [];
  const optional_missing: string[] = [];
  let score = 0;
  // Website is now optional (bonus) — 6 core fields
  const total = 6;

  if (meta.about) score++; else missing.push("about");
  if (meta.rank) score++; else missing.push("rank");
  if (meta.score) score++; else missing.push("score");
  if (logoSaved || currentLogoUrl) score++; else missing.push("logo");
  if (programCount > 0) score++; else missing.push("programs");
  if (pagesDone >= meta.total_pages) score++; else missing.push(`pages_remaining:${meta.total_pages - pagesDone}`);

  // Website tracked as optional (does NOT block done status)
  if (!websiteResolved) optional_missing.push("website");

  const pct = Math.round((score / total) * 100);

  let status: string;
  if (programCount > 0 && pagesDone >= meta.total_pages) {
    status = "uniranks_done";
  } else if (programCount > 0) {
    status = "uniranks_partial";
  } else {
    status = "uniranks_no_programs";
  }

  return { status, score: pct, missing, optional_missing, block_reason: blockReason };
}

// ===== Telemetry =====

async function logStageEvent(
  supabase: any,
  traceId: string,
  uniId: string,
  eventType: string,
  details: Record<string, any>,
) {
  await supabase.from("pipeline_health_events").insert([{
    pipeline: "uniranks_direct",
    event_type: eventType,
    details_json: { trace_id: traceId, uni_id: uniId, extractor: EXTRACTOR_VERSION, ...details },
  }]).then(() => {}).catch(() => {});
}

// ===== Main Handler =====

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const auth = req.headers.get("Authorization") || "";
  if (auth !== `Bearer ${SRV_KEY}`) {
    const adminCheck = await requireAdmin(req);
    if (!adminCheck.ok) return json({ ok: false, error: "forbidden" }, 403);
  }

  const supabase = createClient(SUPABASE_URL, SRV_KEY);
  const body = await req.json().catch(() => ({}));
  const debug = body?.debug === true;
  const slugFilter = body?.slug ?? null;
  const limit = body?.limit ?? 1;
  const traceId = body?.trace_id ?? `UR-${crypto.randomUUID().slice(0, 8)}`;
  const maxPages = body?.max_pages ?? 10;

  const apiKey = Deno.env.get("FIRECRAWL_API_KEY_1") || Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) return json({ ok: false, error: "missing_firecrawl_key" }, 500);

  try {
    if (debug && slugFilter) {
      return await handleDebugScrape(supabase, apiKey, slugFilter, traceId, maxPages);
    }
    const timeBudgetMs = body?.time_budget_ms ?? 35_000;
    return await handleRunnerMode(supabase, apiKey, limit, traceId, slugFilter, timeBudgetMs);
  } catch (err: any) {
    console.error("[uniranks-direct-worker] Fatal:", err);
    return json({ ok: false, error: err?.message, trace_id: traceId }, 500);
  }
});

// ===== DEBUG MODE: Full Evidence Pack for one university =====

async function handleDebugScrape(supabase: any, apiKey: string, slug: string, traceId: string, maxPages: number) {
  // Support lookup by slug, uniranks_slug, id, or profile URL slug
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
  let query = supabase
    .from("universities")
    .select("id, name, slug, uniranks_slug, uniranks_profile_url, logo_url, description, uniranks_rank, uniranks_score, website");
  
  if (isUuid) {
    query = query.eq("id", slug);
  } else {
    query = query.or(`slug.eq.${slug},uniranks_slug.eq.${slug},uniranks_profile_url.like.%/${slug}`);
  }
  const { data: unis } = await query.limit(1);

  if (!unis?.length) return json({ ok: false, error: "university_not_found", trace_id: traceId });
  const uni = unis[0];
  let profileUrl = uni.uniranks_profile_url;
  if (!profileUrl) return json({ ok: false, error: "no_profile_url", trace_id: traceId });

  // === URL Normalizer Fallback ===
  const normalizedUrl = normalizeUniranksProfileUrl(profileUrl);
  if (normalizedUrl !== profileUrl) {
    console.log(`[debug] trace=${traceId} Rewriting profile URL: ${profileUrl} → ${normalizedUrl}`);
    await logStageEvent(supabase, traceId, uni.id, "uniranks_profile_url_rewritten", {
      old_url: profileUrl, new_url: normalizedUrl,
    });
    // Persist the corrected URL
    await supabase.from("universities").update({ uniranks_profile_url: normalizedUrl }).eq("id", uni.id);
    profileUrl = normalizedUrl;
  }

  const uniSlug = profileUrl.replace(/.*\/universities\//, "").replace(/[?#].*$/, "");

  console.log(`[debug] trace=${traceId} Scraping ${uni.name}: ${profileUrl}`);

  // === STAGE D-prep: Scrape page 1 ===
  const { markdown: page1Md, ok: page1Ok, error: page1Err } = await scrapePage(apiKey, profileUrl);
  if (!page1Ok || page1Md.length < 100) {
    return json({
      ok: false, error: "page1_scrape_failed", trace_id: traceId,
      detail: page1Err, markdown_length: page1Md.length,
      markdown_preview: page1Md.slice(0, 500),
    });
  }

  const meta = extractMetadata(page1Md);
  const contentHash = await sha256Hex(page1Md.slice(0, 5000));

  // === STAGE A: Profile Snapshot ===
  const stageAResult = await stageA_ProfileSnapshot(supabase, uni.id, meta, page1Md, traceId);
  await logStageEvent(supabase, traceId, uni.id, "uniranks_profile_scraped", {
    slug: uniSlug, ok: stageAResult.ok,
    sections: meta.sections_present,
    rank: meta.rank, score: meta.score,
    region_label: meta.region_label, region_rank: meta.region_rank,
    country_rank: meta.country_rank, world_rank: meta.world_rank,
    badges: meta.badges, top_buckets: meta.top_buckets,
    verified: meta.verified, recognized: meta.recognized,
  });

  // === STAGE B: Website Resolution (best-effort, non-blocking) ===
  const stageBResult = await stageB_WebsiteResolver(supabase, uni.id, meta, uni.website, profileUrl);
  await logStageEvent(supabase, traceId, uni.id, "uniranks_website_resolved", {
    slug: uniSlug, resolved: stageBResult.resolved,
    website: stageBResult.website, reason: stageBResult.reason,
    candidate_url: stageBResult.website || meta.official_website || null,
    non_blocking: true,
  });

  // === STAGE C: Logo ===
  const logoSaved = await stageC_Logo(supabase, uni.id, uniSlug, uni.logo_url);
  await logStageEvent(supabase, traceId, uni.id, "uniranks_logo_saved", {
    slug: uniSlug, saved: logoSaved, had_existing: !!uni.logo_url,
  });

  // === STAGE D: Programs ===
  const page1Programs = parseProgramsFromMarkdown(page1Md, profileUrl);
  const allPrograms: ParsedProgram[] = [...page1Programs];
  const pageResults: any[] = [{
    page: 1, programs_found: page1Programs.length, md_length: page1Md.length,
    sample: page1Programs.slice(0, 3).map(p => ({
      title: p.title, degree: p.degree, degree_level: p.degree_level,
      tuition: p.tuition_usd ? `${p.tuition_usd} USD/${p.tuition_period}` : null,
      duration_months: p.duration_months,
    })),
  }];

  const effectiveMax = Math.min(meta.total_pages, maxPages);
  let paginationBlocked = false;
  let blockReason: string | undefined;

  if (effectiveMax > 1) {
    for (let page = 2; page <= effectiveMax; page++) {
      const { markdown: pageMd, ok: pageOk } = await scrapePageViaActions(apiKey, profileUrl, page);

      if (!pageOk || pageMd.length < 100) {
        pageResults.push({ page, programs_found: 0, status: "failed", md_length: pageMd.length });
        if (pageMd.length > 100) {
          const page1Sample = page1Md.slice(200, 400);
          if (pageMd.includes(page1Sample)) {
            paginationBlocked = true;
            blockReason = "livewire_actions_failed";
            break;
          }
        }
        continue;
      }

      const pagePrograms = parseProgramsFromMarkdown(pageMd, profileUrl);
      const existingUrls = new Set(allPrograms.map(p => p.url));
      const newPrograms = pagePrograms.filter(p => !existingUrls.has(p.url));
      if (pagePrograms.length > 0 && newPrograms.length === 0) {
        paginationBlocked = true;
        blockReason = "duplicate_content_detected";
        pageResults.push({ page, programs_found: pagePrograms.length, new_programs: 0, status: "pagination_blocked" });
        break;
      }

      allPrograms.push(...newPrograms);
      pageResults.push({
        page, programs_found: pagePrograms.length, new_programs: newPrograms.length,
        md_length: pageMd.length, status: "ok",
      });
    }
  }

  const pagesDone = paginationBlocked ? meta.total_pages : pageResults.filter(p => p.status !== "failed").length;
  const effectivePagesDone = paginationBlocked ? meta.total_pages : pagesDone;

  // Dedup and save
  const seen = new Set<string>();
  const uniquePrograms = allPrograms.filter(p => {
    if (seen.has(p.url)) return false;
    seen.add(p.url);
    return true;
  });

  const { saved, skipped, errors } = await persistPrograms(supabase, uni.id, uniSlug, uniquePrograms, traceId, contentHash);

  await logStageEvent(supabase, traceId, uni.id, "uniranks_programs_page_scraped", {
    slug: uniSlug, total_programs: uniquePrograms.length,
    saved, skipped, pages_done: effectivePagesDone, pages_total: meta.total_pages,
    pagination_blocked: paginationBlocked, block_reason: blockReason,
  });

  // === Completeness Gate ===
  const completeness = assessCompleteness(
    meta, uniquePrograms.length, effectivePagesDone,
    logoSaved, uni.logo_url, stageBResult.resolved, blockReason,
  );

  // Update university status
  // Update university progress via RPC (not direct UPDATE)
  await supabase.rpc("rpc_set_university_crawl_progress", {
    p_university_id: uni.id,
    p_status: completeness.status,
    p_pages_total: meta.total_pages,
    p_pages_done: effectivePagesDone,
    p_trace_id: traceId,
    p_description: meta.about || null,
    p_uniranks_rank: meta.rank,
    p_uniranks_score: meta.score,
  });

  // Final telemetry — event_type MUST match crawl_status exactly
  const STATUS_TO_EVENT: Record<string, string> = {
    uniranks_done: "uniranks_university_done",
    uniranks_partial: "uniranks_university_partial",
    uniranks_no_programs: "uniranks_university_no_programs",
  };
  const finalEvent = STATUS_TO_EVENT[completeness.status] || `uniranks_university_${completeness.status}`;
  await logStageEvent(supabase, traceId, uni.id, finalEvent, {
    slug: uniSlug, completeness_score: completeness.score,
    missing: completeness.missing, optional_missing: completeness.optional_missing, block_reason: blockReason,
    stages: {
      profile: stageAResult.ok,
      website: stageBResult.resolved,
      logo: logoSaved || !!uni.logo_url,
      programs: uniquePrograms.length,
    },
  });

  return json({
    ok: true,
    trace_id: traceId,
    extractor: EXTRACTOR_VERSION,
    university: { id: uni.id, name: uni.name, slug: uniSlug, profile_url: profileUrl },
    stages: {
      A_profile: { ok: stageAResult.ok, error: stageAResult.error, sections: meta.sections_present },
      B_website: stageBResult,
      C_logo: { saved: logoSaved, had_existing: !!uni.logo_url },
      D_programs: {
        found_total: uniquePrograms.length, saved, skipped_duplicates: skipped, errors,
        pages_done: effectivePagesDone, pages_total: meta.total_pages,
        pagination_blocked: paginationBlocked, block_reason: blockReason,
        page_results: pageResults,
        sample: uniquePrograms.slice(0, 10).map(p => ({
          title: p.title, degree: p.degree, degree_level: p.degree_level,
          tuition_usd: p.tuition_usd, tuition_period: p.tuition_period,
          duration_months: p.duration_months, language: p.language, study_mode: p.study_mode, url: p.url,
        })),
      },
    },
    metadata_extracted: {
      about_preview: meta.about?.slice(0, 300),
      rank: meta.rank, score: meta.score,
      verified: meta.verified, recognized: meta.recognized,
      country_rank: meta.country_rank, region_rank: meta.region_rank,
      world_rank: meta.world_rank, region_label: meta.region_label,
      badges: meta.badges, top_buckets: meta.top_buckets,
      students_count: meta.students_count, acceptance_rate: meta.acceptance_rate, type: meta.type,
    },
    raw_excerpt: {
      website_area: page1Md.match(/(?:.{0,200}(?:website|site|homepage).{0,200})/i)?.[0]?.slice(0, 400) || "no_match",
      first_500: page1Md.slice(0, 500),
    },
    completeness,
  });
}

// ===== RUNNER MODE: Process N universities per tick =====

async function handleRunnerMode(supabase: any, apiKey: string, limit: number, traceId: string, slugFilter: string | null, timeBudgetMs: number = 35_000) {
  const runnerStart = Date.now();
  const SAFETY_MARGIN_MS = 5_000; // Exit cleanly 5s before budget

  const MAX_RETRIES = 3;
  const BACKOFF_MINUTES = [2, 5, 15]; // exponential-ish backoff

  let query = supabase
    .from("universities")
    .select("id, name, slug, uniranks_slug, uniranks_profile_url, logo_url, description, uniranks_rank, uniranks_score, uniranks_program_pages_total, uniranks_program_pages_done, website, uniranks_retry_count, uniranks_next_retry_at")
    .not("uniranks_profile_url", "is", null)
    .eq("is_active", true);

  if (slugFilter) {
    query = query.or(`slug.eq.${slugFilter},uniranks_slug.eq.${slugFilter}`);
  } else {
    // Exclude terminal states + quarantined
    query = query
      .not("crawl_status", "in", '("uniranks_done","uniranks_no_programs","uniranks_partial_done")')
      // Exclude universities in backoff period
      .or("uniranks_next_retry_at.is.null,uniranks_next_retry_at.lte." + new Date().toISOString())
      .order("uniranks_rank", { ascending: true, nullsFirst: false });
  }

  const { data: universities, error: queryErr } = await query.limit(limit);
  if (queryErr) throw queryErr;
  if (!universities?.length) return json({ ok: true, message: "no_eligible_universities", trace_id: traceId });

  const results = {
    processed: 0,
    programs_found: 0,
    programs_saved: 0,
    errors: [] as string[],
    trace_id: traceId,
    details: [] as any[],
    exited_reason: "completed" as string,
  };

  for (const uni of universities) {
    // === TIME BUDGET CHECK: exit cleanly if running low ===
    const elapsed = Date.now() - runnerStart;
    if (elapsed > timeBudgetMs - SAFETY_MARGIN_MS) {
      results.exited_reason = `time_budget_reached_${elapsed}ms`;
      console.log(`[runner] Time budget reached (${elapsed}ms/${timeBudgetMs}ms), exiting cleanly after ${results.processed} universities`);
      break;
    }

    try {
      let profileUrl = uni.uniranks_profile_url;
      if (!profileUrl) continue;

      // === URL Normalizer Fallback (runner path) ===
      const normalizedUrl = normalizeUniranksProfileUrl(profileUrl);
      if (normalizedUrl !== profileUrl) {
        console.log(`[runner] trace=${traceId} Rewriting profile URL: ${profileUrl} → ${normalizedUrl}`);
        await supabase.from("pipeline_health_events").insert({
          pipeline: "crawl_uniranks", event_type: "state",
          metric: "uniranks_profile_url_rewritten", value: 1,
          details_json: { trace_id: traceId, university_id: uni.id, old_url: profileUrl, new_url: normalizedUrl },
        });
        await supabase.from("universities").update({ uniranks_profile_url: normalizedUrl }).eq("id", uni.id);
        profileUrl = normalizedUrl;
      }

      const uniSlug = profileUrl.replace(/.*\/universities\//, "").replace(/[?#].*$/, "");

      const { markdown, ok, error: scrapeErr } = await scrapePage(apiKey, profileUrl);
      if (!ok || markdown.length < 100) {
        const isTimeout = scrapeErr?.includes("timeout") || scrapeErr?.includes("abort");
        const newRetryCount = (uni.uniranks_retry_count || 0) + 1;
        results.errors.push(`${uni.name}: scrape_failed (${scrapeErr}) [attempt ${newRetryCount}/${MAX_RETRIES}]`);

        await logStageEvent(supabase, traceId, uni.id, "uniranks_scrape_failed", {
          slug: uniSlug, error: scrapeErr, is_timeout: isTimeout,
          retry_count: newRetryCount, max_retries: MAX_RETRIES,
        });

        if (newRetryCount >= MAX_RETRIES) {
          // QUARANTINE: exhausted retries → terminal state
          await supabase.from("universities").update({
            crawl_status: "uniranks_partial_done",
            crawl_error: JSON.stringify({ reason: "scrape_failed_exhausted", last_error: scrapeErr, attempts: newRetryCount }),
            uniranks_retry_count: newRetryCount,
            uniranks_next_retry_at: null,
          }).eq("id", uni.id);
          console.log(`[runner] ${uni.name}: QUARANTINED after ${newRetryCount} failures (scrape_failed)`);
        } else {
          // BACKOFF: retry later
          const backoffMin = BACKOFF_MINUTES[Math.min(newRetryCount - 1, BACKOFF_MINUTES.length - 1)];
          const nextRetry = new Date(Date.now() + backoffMin * 60_000).toISOString();
          await supabase.from("universities").update({
            uniranks_retry_count: newRetryCount,
            uniranks_next_retry_at: nextRetry,
          }).eq("id", uni.id);
          console.log(`[runner] ${uni.name}: backoff ${backoffMin}min (attempt ${newRetryCount}/${MAX_RETRIES})`);
        }
        continue;
      }

      const meta = extractMetadata(markdown);
      const contentHash = await sha256Hex(markdown.slice(0, 5000));

      // Stage A: Profile
      await stageA_ProfileSnapshot(supabase, uni.id, meta, markdown, traceId);

      // Stage B: Website
      const webResult = await stageB_WebsiteResolver(supabase, uni.id, meta, uni.website, profileUrl);

      // Stage C: Logo
      const logoSaved = await stageC_Logo(supabase, uni.id, uniSlug, uni.logo_url);

      // Stage D: Programs — resumable pagination from pages_done cursor
      const previousPagesDone = uni.uniranks_program_pages_done || 0;
      const allFoundPrograms: ParsedProgram[] = [];
      let pagesDone = previousPagesDone;
      let blockReason: string | undefined;
      let paginationFailed = false;
      const PAGES_PER_TICK = 2; // budget: process max 2 pages per runner tick

      // If page 1 not yet done, process it from the initial scrape
      if (previousPagesDone < 1) {
        const programs = parseProgramsFromMarkdown(markdown, profileUrl);
        allFoundPrograms.push(...programs);
        results.programs_found += programs.length;

        let pageSaved = 0;
        if (programs.length > 0) {
          const { saved, errors } = await persistPrograms(supabase, uni.id, uniSlug, programs, traceId, contentHash);
          results.programs_saved += saved;
          pageSaved = saved;
          if (errors.length) results.errors.push(...errors);
        }
        pagesDone = 1;

        // Per-page telemetry for page 1
        await logStageEvent(supabase, traceId, uni.id, "uniranks_programs_page_scraped", {
          slug: uniSlug, page_number: 1, pages_done_after: 1,
          md_length: markdown.length, found: programs.length, saved: pageSaved,
          duplicates: 0, pages_total: meta.total_pages,
        });
      }

      // Resume pagination from where we left off
      if (meta.total_pages > 1 && pagesDone < meta.total_pages) {
        const startPage = pagesDone + 1;
        const endPage = Math.min(pagesDone + PAGES_PER_TICK, meta.total_pages);

        for (let page = startPage; page <= endPage; page++) {
          // Time budget check inside pagination loop
          if (Date.now() - runnerStart > timeBudgetMs - SAFETY_MARGIN_MS) {
            console.log(`[runner] ${uni.name}: time budget reached during pagination, saving progress at page ${pagesDone}`);
            break;
          }
          console.log(`[runner] ${uni.name}: scraping page ${page}/${meta.total_pages} via actions`);
          const { markdown: pageMd, ok: pageOk } = await scrapePageViaActions(apiKey, profileUrl, page);
          console.log(`[runner] ${uni.name}: page ${page} result: ok=${pageOk}, md_length=${pageMd.length}`);

          if (!pageOk || pageMd.length < 100) {
            // Check if Livewire actions completely failed (same content as page 1)
            if (pageMd.length > 100) {
              const p1Sample = markdown.slice(200, 400);
              if (pageMd.includes(p1Sample)) {
                blockReason = "livewire_actions_failed";
                console.log(`[runner] ${uni.name}: livewire_actions_failed on page ${page}`);
                await logStageEvent(supabase, traceId, uni.id, "uniranks_programs_page_scrape_failed", {
                  slug: uniSlug, page_number: page, reason: "livewire_actions_failed",
                  md_length: pageMd.length, pages_total: meta.total_pages,
                });
                // Increment retry for pagination failure
                paginationFailed = true;
                break;
              }
            }
            blockReason = `page${page}_scrape_failed`;
            console.log(`[runner] ${uni.name}: page ${page} scrape failed`);
            await logStageEvent(supabase, traceId, uni.id, "uniranks_programs_page_scrape_failed", {
              slug: uniSlug, page_number: page, reason: blockReason,
              md_length: pageMd.length, pages_total: meta.total_pages,
            });
            paginationFailed = true;
            break;
          }

          const pagePrograms = parseProgramsFromMarkdown(pageMd, profileUrl);
          // Dedup against already found programs in this tick
          const existingUrls = new Set(allFoundPrograms.map(p => p.url));
          const newPrograms = pagePrograms.filter(p => !existingUrls.has(p.url));

          if (pagePrograms.length > 0 && newPrograms.length === 0) {
            pagesDone = meta.total_pages;
            blockReason = "duplicate_content_detected";
            // Telemetry for duplicate detection
            await logStageEvent(supabase, traceId, uni.id, "uniranks_programs_page_scraped", {
              slug: uniSlug, page_number: page, pages_done_after: pagesDone,
              md_length: pageMd.length, found: pagePrograms.length, saved: 0,
              duplicates: pagePrograms.length, pages_total: meta.total_pages,
              status: "duplicate_content_detected",
            });
            break;
          }

          let pageSaved = 0;
          if (newPrograms.length > 0) {
            const { saved, errors } = await persistPrograms(supabase, uni.id, uniSlug, newPrograms, traceId, contentHash);
            results.programs_found += newPrograms.length;
            results.programs_saved += saved;
            pageSaved = saved;
            allFoundPrograms.push(...newPrograms);
            if (errors.length) results.errors.push(...errors);
          }
          pagesDone = page;

          // Per-page telemetry
          await logStageEvent(supabase, traceId, uni.id, "uniranks_programs_page_scraped", {
            slug: uniSlug, page_number: page, pages_done_after: pagesDone,
            md_length: pageMd.length, found: pagePrograms.length,
            saved: pageSaved, duplicates: pagePrograms.length - newPrograms.length,
            pages_total: meta.total_pages,
          });
        }
      }

      // Get actual draft count from DB for accurate completeness
      const { count: dbDraftCount } = await supabase
        .from("program_draft")
        .select("id", { head: true, count: "exact" })
        .eq("university_id", uni.id);
      const totalPrograms = dbDraftCount ?? allFoundPrograms.length;

      const completeness = assessCompleteness(
        meta, totalPrograms > 0 ? totalPrograms : (previousPagesDone > 0 ? 1 : 0), pagesDone,
        logoSaved, uni.logo_url, webResult.resolved, blockReason,
      );

      // === PARTIAL QUARANTINE: retry/backoff/terminal for stuck partial universities ===
      let finalStatus = completeness.status;
      if (completeness.status === "uniranks_partial" && paginationFailed) {
        const newRetryCount = (uni.uniranks_retry_count || 0) + 1;
        if (newRetryCount >= MAX_RETRIES) {
          // TERMINAL: exhausted retries → uniranks_partial_done (NOT done)
          finalStatus = "uniranks_partial_done";
          await supabase.from("universities").update({
            uniranks_retry_count: newRetryCount,
            uniranks_next_retry_at: null,
            crawl_error: JSON.stringify({
              reason: "pagination_exhausted",
              last_block: blockReason,
              pages_done: pagesDone,
              pages_total: meta.total_pages,
              attempts: newRetryCount,
            }),
          }).eq("id", uni.id);
          console.log(`[runner] ${uni.name}: QUARANTINED as partial_done after ${newRetryCount} pagination failures (${blockReason})`);
        } else {
          // BACKOFF: schedule retry
          const backoffMin = BACKOFF_MINUTES[Math.min(newRetryCount - 1, BACKOFF_MINUTES.length - 1)];
          const nextRetry = new Date(Date.now() + backoffMin * 60_000).toISOString();
          await supabase.from("universities").update({
            uniranks_retry_count: newRetryCount,
            uniranks_next_retry_at: nextRetry,
          }).eq("id", uni.id);
          console.log(`[runner] ${uni.name}: pagination backoff ${backoffMin}min (attempt ${newRetryCount}/${MAX_RETRIES})`);
        }
      } else if (completeness.status === "uniranks_done" || completeness.status === "uniranks_no_programs") {
        // Success → reset retry counters
        await supabase.from("universities").update({
          uniranks_retry_count: 0,
          uniranks_next_retry_at: null,
        }).eq("id", uni.id);
      }

      await supabase.rpc("rpc_set_university_crawl_progress", {
        p_university_id: uni.id,
        p_status: finalStatus,
        p_pages_total: meta.total_pages,
        p_pages_done: pagesDone,
        p_trace_id: traceId,
        p_description: meta.about || null,
        p_uniranks_rank: meta.rank,
        p_uniranks_score: meta.score,
      });

      // Final completeness event — pages_done aligned with DB write above
      const STATUS_TO_EVENT: Record<string, string> = {
        uniranks_done: "uniranks_university_done",
        uniranks_partial: "uniranks_university_partial",
        uniranks_partial_done: "uniranks_university_quarantined",
        uniranks_no_programs: "uniranks_university_no_programs",
      };
      const finalEvent = STATUS_TO_EVENT[finalStatus] || `uniranks_university_${finalStatus}`;
      await logStageEvent(supabase, traceId, uni.id, finalEvent, {
        slug: uniSlug, completeness_score: completeness.score,
        pages_done: pagesDone, pages_total: meta.total_pages,
        total_drafts_in_db: totalPrograms, resumed_from: previousPagesDone,
        retry_count: uni.uniranks_retry_count || 0,
        quarantined: finalStatus === "uniranks_partial_done",
        missing: completeness.missing, optional_missing: completeness.optional_missing,
        block_reason: blockReason,
        stages: {
          profile: true, website: webResult.resolved,
          logo: logoSaved || !!uni.logo_url, programs: totalPrograms,
        },
      });

      results.processed++;
      results.details.push({
        name: uni.name, slug: uniSlug,
        programs_found: allFoundPrograms.length, total_drafts_in_db: totalPrograms,
        pages_done: pagesDone, pages_total: meta.total_pages, resumed_from: previousPagesDone,
        completeness: completeness.status,
        stages: {
          profile: true,
          website: webResult.resolved,
          logo: logoSaved || !!uni.logo_url,
          programs: totalPrograms,
        },
      });

      await new Promise(r => setTimeout(r, 500));
    } catch (e: any) {
      results.errors.push(`${uni.name}: ${e?.message?.slice(0, 100)}`);
    }
  }

  // Summary telemetry
  await supabase.from("pipeline_health_events").insert([{
    pipeline: "uniranks_direct",
    event_type: "metric",
    metric: "runner_tick",
    value: results.processed,
    details_json: {
      trace_id: traceId,
      programs_found: results.programs_found,
      programs_saved: results.programs_saved,
      universities_processed: results.processed,
      extractor: EXTRACTOR_VERSION,
    },
  }]);

  return json({ ok: true, ...results });
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
