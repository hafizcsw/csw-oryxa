import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function supaAdmin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const PARSER_VERSION = "osc-hard-v2.2";

// ════════════════════════════════════════════════════════
// TRUTH-POLICY MATRIX (unchanged from v1.1)
// ════════════════════════════════════════════════════════
type SourceTier = "live" | "url_variant" | "google_cache" | "wayback_machine";
type VerifyTier = "auto_verify" | "verify_only" | "review_only" | "never_publish";

const TRUTH_POLICY: Record<FactGroup, Record<SourceTier, VerifyTier>> = {
  identity:              { live: "auto_verify",  url_variant: "auto_verify",  google_cache: "verify_only",  wayback_machine: "verify_only" },
  contact_location:      { live: "auto_verify",  url_variant: "auto_verify",  google_cache: "verify_only",  wayback_machine: "review_only" },
  programs:              { live: "auto_verify",  url_variant: "auto_verify",  google_cache: "verify_only",  wayback_machine: "verify_only" },
  housing:               { live: "auto_verify",  url_variant: "auto_verify",  google_cache: "verify_only",  wayback_machine: "review_only" },
  student_life:          { live: "auto_verify",  url_variant: "auto_verify",  google_cache: "verify_only",  wayback_machine: "verify_only" },
  media_brochures:       { live: "auto_verify",  url_variant: "auto_verify",  google_cache: "verify_only",  wayback_machine: "review_only" },
  cta_links:             { live: "auto_verify",  url_variant: "auto_verify",  google_cache: "review_only",  wayback_machine: "never_publish" },
  language_requirements: { live: "auto_verify",  url_variant: "auto_verify",  google_cache: "verify_only",  wayback_machine: "review_only" },
  admissions:            { live: "auto_verify",  url_variant: "verify_only",  google_cache: "review_only",  wayback_machine: "review_only" },
  deadlines_intakes:     { live: "auto_verify",  url_variant: "verify_only",  google_cache: "never_publish", wayback_machine: "never_publish" },
  tuition_fees:          { live: "auto_verify",  url_variant: "verify_only",  google_cache: "never_publish", wayback_machine: "never_publish" },
  scholarships:          { live: "auto_verify",  url_variant: "verify_only",  google_cache: "review_only",  wayback_machine: "never_publish" },
};

function resolveSourceTier(source: string): SourceTier {
  if (source === "direct_retry" || source === "official_website" || source === "subdomain_live") return "live";
  if (source === "url_variant") return "url_variant";
  if (source === "google_cache") return "google_cache";
  if (source === "wayback_machine") return "wayback_machine";
  if (source.startsWith("official_website_google_cache")) return "google_cache";
  if (source.startsWith("official_website_wayback")) return "wayback_machine";
  if (source.startsWith("official_website_url_variant")) return "url_variant";
  if (source.startsWith("official_website")) return "live";
  return "live";
}

function getVerifyTier(factGroup: FactGroup, sourceTier: SourceTier): VerifyTier {
  return TRUTH_POLICY[factGroup]?.[sourceTier] ?? "review_only";
}

const FETCH_TIMEOUT_MS = 20_000;
const TIME_BUDGET_MS = 120_000; // increased for subdomain probing
const MAX_PAGES = 20;

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
  "Googlebot/2.1 (+http://www.google.com/bot.html)",
];
function pickUA(): string { return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]; }

const FACT_GROUPS = [
  "identity", "contact_location", "admissions", "deadlines_intakes",
  "tuition_fees", "scholarships", "language_requirements", "programs",
  "housing", "student_life", "media_brochures", "cta_links",
] as const;
type FactGroup = typeof FACT_GROUPS[number];

const DISCOVERY_CATEGORIES: Array<{ keywords: RegExp; category: string; factGroups: FactGroup[] }> = [
  { keywords: /about|overview|profile|mission|history|university|об.?университете|о.?вузе/i, category: "about", factGroups: ["identity", "contact_location"] },
  { keywords: /admission|apply|requirement|entry|приём|прием|поступлен|abit|abiturient/i, category: "admissions", factGroups: ["admissions", "deadlines_intakes", "cta_links"] },
  { keywords: /tuition|fee|cost|price|financi|стоимость|оплата|стипенди/i, category: "fees", factGroups: ["tuition_fees", "scholarships"] },
  { keywords: /program|course|curricul|degree|bachelor|master|бакалавр|магистр|аспирант|направлен/i, category: "programs", factGroups: ["programs"] },
  { keywords: /scholar|grant|fellowship|financial.?aid|стипенди|грант/i, category: "scholarships", factGroups: ["scholarships", "tuition_fees"] },
  { keywords: /accommodat|housing|dormitor|hostel|residence|общежити|кампус|campus/i, category: "housing", factGroups: ["housing"] },
  { keywords: /international|foreign|overseas|exchange|иностранн|международн|foreign.?student/i, category: "international", factGroups: ["admissions", "language_requirements", "tuition_fees"] },
  { keywords: /ielts|toefl|english|language|proficiency|языков/i, category: "language", factGroups: ["language_requirements"] },
  { keywords: /facult|department|institut|school|academic|факультет|институт|кафедр/i, category: "academics", factGroups: ["programs"] },
  { keywords: /contact|address|phone|location|контакт|адрес|телефон/i, category: "contact", factGroups: ["contact_location", "cta_links"] },
  { keywords: /student.?life|club|sport|facilit|campus.?life|activit|студенческ|внеучебн|спорт/i, category: "student_life", factGroups: ["student_life"] },
  { keywords: /deadline|intake|calendar|academic.?year|semester|срок|приём.?документ|набор/i, category: "deadlines", factGroups: ["deadlines_intakes"] },
  { keywords: /brochure|download|media|gallery|photo|video|медиа|фото|видео/i, category: "media", factGroups: ["media_brochures"] },
  { keywords: /apply.?online|inquiry|registration|online.?form|подать.?заявк|регистрац|заявлен/i, category: "cta", factGroups: ["cta_links", "deadlines_intakes"] },
];

// ─── Anti-bot classification ───
const HARD_BLOCK_PATTERNS = [
  /captcha/i, /verify you are human/i, /access denied/i,
  /checking your browser/i, /attention required/i, /bot detection/i,
  /security check/i, /you have been blocked/i, /are you a robot/i,
  /blocked by/i, /403 forbidden/i,
];
const JS_ONLY_PATTERNS = [
  /please enable javascript/i, /javascript is required/i,
  /this page requires javascript/i,
  // Only match <noscript> that contains "enable javascript" type messages,
  // NOT analytics/tracker <noscript> tags (e.g. Yandex Metrika, GTM)
  /<noscript[^>]*>[^<]*(?:enable|require|need|activate)\s+javascript[^<]*<\/noscript>/i,
];
const JS_FRAMEWORK_MARKERS = [
  /id=["']react-root["']/i, /id=["']__next["']/i,
  /id=["']ng-app["']/i, /id=["']app-root["']/i,
];
const CLOUDFLARE_PATTERNS = [
  /just a moment/i, /cloudflare/i, /ray id/i, /one more step/i,
];

type PageType = "ok" | "js_only" | "hard_block" | "cloudflare" | "empty";

function classifyPage(text: string, html: string): PageType {
  if (!text || text.length < 20) return "empty";
  const snippet = text.slice(0, 3000).toLowerCase();
  const htmlSnippet = html.slice(0, 5000).toLowerCase();
  if (CLOUDFLARE_PATTERNS.filter(p => p.test(snippet)).length >= 2) return "cloudflare";
  if (HARD_BLOCK_PATTERNS.filter(p => p.test(snippet)).length >= 1) return "hard_block";

  // Content-richness override: if extracted text is substantial, it IS real SSR content
  // regardless of framework markers or <noscript> analytics tags
  if (text.length >= 500) return "ok";

  const hasJsOnlySignal = JS_ONLY_PATTERNS.some(p => p.test(htmlSnippet));
  const hasFrameworkOnly = JS_FRAMEWORK_MARKERS.some(p => p.test(htmlSnippet));
  const tooShort = text.length < 300;
  if (hasJsOnlySignal || (hasFrameworkOnly && tooShort) || (tooShort && htmlSnippet.includes("<script"))) return "js_only";
  return "ok";
}

// ─── Domain validation ───
const BLOCKED_DOMAINS = [
  "uniranks.com", "4icu.org", "topuniversities.com", "webometrics.info",
  "whed.net", "studyportals.com", "hotcourses.com", "firecrawl.dev",
  "google.com", "facebook.com", "twitter.com", "instagram.com",
  "linkedin.com", "youtube.com", "wikipedia.org",
];

function getOfficialDomain(website: string): string | null {
  try {
    const url = new URL(website.startsWith("http") ? website : `https://${website}`);
    const host = url.hostname.toLowerCase();
    if (BLOCKED_DOMAINS.some(d => host.endsWith(d))) return null;
    return host;
  } catch { return null; }
}

/** Check if a URL belongs to the official domain family (same base domain) */
function isWithinDomainFamily(pageUrl: string, baseDomain: string): boolean {
  try {
    const host = new URL(pageUrl).hostname.toLowerCase();
    // Strip www from both for comparison
    const stripWww = (h: string) => h.replace(/^www\./, "");
    const base = stripWww(baseDomain);
    const target = stripWww(host);
    return target === base || target.endsWith(`.${base}`);
  } catch { return false; }
}

// ════════════════════════════════════════════════════════
// FIX 1: SUBDOMAIN-FAMILY ENTRYPOINT DISCOVERY
// ════════════════════════════════════════════════════════

/** 
 * Known institutional subdomain prefixes by purpose.
 * Ordered by expected information density for each category.
 */
const SUBDOMAIN_PREFIXES: Array<{ prefix: string; purpose: string; categories: string[] }> = [
  // English / international portals (highest priority for intl data)
  { prefix: "en",           purpose: "english_portal",       categories: ["identity", "admissions", "fees", "programs", "international"] },
  { prefix: "int",          purpose: "international_portal",  categories: ["admissions", "fees", "international", "scholarships"] },
  { prefix: "international",purpose: "international_portal",  categories: ["admissions", "fees", "international", "scholarships"] },
  { prefix: "english",      purpose: "english_portal",       categories: ["identity", "admissions", "fees", "programs"] },
  // Admissions / applicant portals
  { prefix: "abit",         purpose: "admissions_portal",    categories: ["admissions", "deadlines", "cta", "programs"] },
  { prefix: "abiturient",   purpose: "admissions_portal",    categories: ["admissions", "deadlines", "cta"] },
  { prefix: "admissions",   purpose: "admissions_portal",    categories: ["admissions", "deadlines", "cta"] },
  { prefix: "apply",        purpose: "application_portal",   categories: ["cta", "deadlines", "admissions"] },
  { prefix: "admission",    purpose: "admissions_portal",    categories: ["admissions", "deadlines", "cta"] },
  // Student life / services
  { prefix: "student",      purpose: "student_portal",       categories: ["housing", "student_life"] },
  { prefix: "students",     purpose: "student_portal",       categories: ["housing", "student_life"] },
  { prefix: "campus",       purpose: "campus_portal",        categories: ["housing", "student_life", "contact"] },
  { prefix: "dorm",         purpose: "housing_portal",       categories: ["housing"] },
  // Academic
  { prefix: "edu",          purpose: "education_portal",     categories: ["programs", "academics"] },
  { prefix: "programs",     purpose: "programs_catalog",     categories: ["programs"] },
  // Media
  { prefix: "media",        purpose: "media_portal",         categories: ["media"] },
  { prefix: "news",         purpose: "news_portal",          categories: ["identity"] },
  // www fallback
  { prefix: "www",          purpose: "main_www",             categories: ["identity", "contact"] },
];

interface SubdomainProbeResult {
  url: string;
  subdomain: string;
  purpose: string;
  categories: string[];
  status: number;
  contentLength: number;
  title: string;
  pageType: PageType;
  score: number;
}

/**
 * Probe all institutional subdomains and score them.
 * Returns sorted list of live subdomains with their purpose/quality.
 */
async function discoverSubdomainFamily(baseDomain: string): Promise<SubdomainProbeResult[]> {
  const stripWww = (h: string) => h.replace(/^www\./, "");
  const rootDomain = stripWww(baseDomain);
  
  console.log(`[HARD-v2] Probing subdomain family for ${rootDomain}`);
  
  const results: SubdomainProbeResult[] = [];
  
  // Probe all subdomains in parallel (batches of 5 to avoid overwhelming)
  const probes = SUBDOMAIN_PREFIXES.map(sp => ({
    ...sp,
    url: `https://${sp.prefix}.${rootDomain}`,
  }));
  
  // Also add root domain itself
  probes.push({
    prefix: "",
    purpose: "root",
    categories: ["identity", "contact"],
    url: `https://${rootDomain}`,
  });
  
  // Also add /en/ path on root (some universities use path-based i18n)
  probes.push({
    prefix: "",
    purpose: "root_en_path",
    categories: ["identity", "admissions", "fees", "programs"],
    url: `https://${rootDomain}/en/`,
  });
  probes.push({
    prefix: "",
    purpose: "root_en_path",
    categories: ["identity", "admissions", "fees", "programs"],
    url: `https://www.${rootDomain}/en/`,
  });
  
  const BATCH_SIZE = 6;
  for (let i = 0; i < probes.length; i += BATCH_SIZE) {
    const batch = probes.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(async (probe) => {
        try {
          const { html, status, finalUrl } = await fetchRaw(probe.url, { timeout: 10_000 });
          if (status < 200 || status >= 400) return null;
          
          const text = htmlToText(html);
          const pageType = classifyPage(text, html);
          const title = extractTitle(html);
          
          // Score this entrypoint
          let score = 0;
          if (pageType === "ok") score += 50;
          else if (pageType === "js_only" && text.length > 100) score += 15;
          else return null; // empty/blocked = don't use
          
          // Bonus for content richness
          if (text.length > 2000) score += 20;
          else if (text.length > 500) score += 10;
          
          // Bonus for English content (useful for international data)
          if (/admission|program|tuition|fee|bachelor|master|apply|scholarship/i.test(text)) score += 15;
          
          // Bonus for having navigational links
          const anchorCount = (html.match(/<a\s/gi) || []).length;
          if (anchorCount > 20) score += 10;
          
          // Penalty for being a redirect to the same page we already have
          const finalHost = new URL(finalUrl).hostname.toLowerCase();
          if (finalHost !== new URL(probe.url).hostname.toLowerCase()) {
            // Redirected — only useful if still in domain family
            if (!isWithinDomainFamily(finalUrl, rootDomain)) return null;
          }
          
          return {
            url: finalUrl, // use final URL after redirects
            subdomain: probe.prefix || "(root)",
            purpose: probe.purpose,
            categories: probe.categories,
            status,
            contentLength: text.length,
            title,
            pageType,
            score,
          } as SubdomainProbeResult;
        } catch { return null; }
      })
    );
    
    for (const r of batchResults) {
      if (r.status === "fulfilled" && r.value) results.push(r.value);
    }
  }
  
  // Deduplicate by final URL
  const seen = new Set<string>();
  const deduped = results.filter(r => {
    const key = r.url.replace(/\/+$/, "").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  // Sort by score descending
  deduped.sort((a, b) => b.score - a.score);
  
  console.log(`[HARD-v2] Found ${deduped.length} live subdomains: ${deduped.map(d => `${d.subdomain}(${d.score})`).join(", ")}`);
  return deduped;
}

// ════════════════════════════════════════════════════════
// FIX 2: ENTRYPOINT SCORING — choose best domains per category
// ════════════════════════════════════════════════════════

interface ChosenEntrypoints {
  identity: SubdomainProbeResult | null;
  admissions: SubdomainProbeResult | null;
  programs: SubdomainProbeResult | null;
  fees: SubdomainProbeResult | null;
  contact: SubdomainProbeResult | null;
  housing: SubdomainProbeResult | null;
  general: SubdomainProbeResult[];
}

function chooseEntrypoints(probeResults: SubdomainProbeResult[]): ChosenEntrypoints {
  const findBest = (category: string): SubdomainProbeResult | null => {
    return probeResults.find(r => r.categories.includes(category) && r.score >= 30) || null;
  };
  
  return {
    identity: findBest("identity"),
    admissions: findBest("admissions"),
    programs: findBest("programs"),
    fees: findBest("fees"),
    contact: findBest("contact"),
    housing: findBest("housing"),
    general: probeResults.filter(r => r.score >= 30).slice(0, 5),
  };
}

// ════════════════════════════════════════════════════════
// FIX 3: AUTHENTICITY CHECKS for cache/archive content
// ════════════════════════════════════════════════════════

/** Patterns that indicate Google interstitial / consent / wrapper noise */
const CACHE_GARBAGE_PATTERNS = [
  /google\.com\/policies/i,
  /consent\.google/i,
  /before you continue/i,
  /we use cookies/i,
  /class="[^"]*g-recaptcha/i,
  /accounts\.google\.com/i,
  /<title[^>]*>Before you continue/i,
  /google\s+logo/i,
  /www\.gstatic\.com/i,
  /consent-bump/i,
  /302 Moved/i,
  /<meta[^>]*url=https?:\/\/consent\.google/i,
];

/** Patterns that indicate Wayback Machine wrapper noise */
const WAYBACK_WRAPPER_PATTERNS = [
  /web\.archive\.org\/_static/i,
  /wombat\.js/i,
  /<!-- End Wayback Rewrite -->/i,
  /id="wm-ipp"/i,
  /playback\.bundle\.js/i,
];

/** 
 * Validate that fetched cache/archive content is actually the university page,
 * not a wrapper, consent page, or redirect interstitial.
 */
function validateCacheAuthenticity(html: string, text: string, expectedDomain: string): { valid: boolean; reason?: string } {
  // Check for Google consent/interstitial
  const garbageHits = CACHE_GARBAGE_PATTERNS.filter(p => p.test(html));
  if (garbageHits.length >= 2) {
    return { valid: false, reason: "google_consent_interstitial" };
  }
  
  // Check if the title is a Google page, not the university
  const title = extractTitle(html).toLowerCase();
  if (title.includes("before you continue") || title.includes("google") || title === "") {
    // Empty title from cache is suspicious — check if content has the domain
    if (!html.toLowerCase().includes(expectedDomain.replace(/^www\./, ""))) {
      return { valid: false, reason: "title_mismatch_no_domain_ref" };
    }
  }
  
  // Minimum content threshold (after stripping scripts/styles)
  if (text.length < 200) {
    return { valid: false, reason: "insufficient_content" };
  }
  
  // Must have at least some institutional markers
  const institutionalMarkers = /university|institut|academ|faculty|program|admission|student|campus|research|образован|университет|институт/i;
  if (!institutionalMarkers.test(text)) {
    return { valid: false, reason: "no_institutional_markers" };
  }
  
  return { valid: true };
}

/** Clean Wayback Machine wrapper from HTML */
function cleanWaybackHtml(html: string): string {
  // Remove Wayback toolbar
  let cleaned = html.replace(/<!-- BEGIN WAYBACK TOOLBAR INSERT -->[\s\S]*?<!-- END WAYBACK TOOLBAR INSERT -->/gi, "");
  // Remove wm-ipp-base div
  cleaned = cleaned.replace(/<div\s+id="wm-ipp-base"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi, "");
  // Fix rewritten URLs (web.archive.org/web/TIMESTAMP/original_url → original_url)
  cleaned = cleaned.replace(/https?:\/\/web\.archive\.org\/web\/\d+\//gi, "");
  return cleaned;
}

// ════════════════════════════════════════════════════════
// FIX 4: STRICT VALIDATORS for phone and CTA
// ════════════════════════════════════════════════════════

/** Validate a phone number is actually a phone, not a year or ID */
function isValidPhone(raw: string): boolean {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  
  // Must have at least 7 digits and at most 15
  if (digits.length < 7 || digits.length > 15) return false;
  
  // Reject year-like patterns: 1993-2026, ©2024, etc.
  if (/^(19|20)\d{2}[–\-](19|20)\d{2}/.test(trimmed)) return false;
  if (/^(19|20)\d{2}$/.test(digits)) return false;
  if (/^\d{4}\s*[-–]\s*\d{4}$/.test(trimmed)) return false;
  
  // MUST contain a '+' country code prefix, or parenthesized area code, or dash-separated groups
  // Reject bare digit strings like "45660640" that lack formatting
  const hasCountryCode = /^\+/.test(trimmed);
  const hasParenArea = /\(\d{2,5}\)/.test(trimmed);
  const hasDashGroups = /\d{2,4}[\s\-]\d{2,4}[\s\-]\d{2,4}/.test(trimmed);
  const hasPhonePrefix = /(?:tel|phone|fax|тел|факс)[:\s]/i.test(trimmed);
  
  if (!hasCountryCode && !hasParenArea && !hasDashGroups && !hasPhonePrefix) return false;
  
  return true;
}

/** 
 * Validate CTA link is actually a useful application/contact link,
 * not a policy/doc/social/generic link.
 */
function isValidCtaLink(url: string, linkText: string): boolean {
  const lower = url.toLowerCase();
  const textLower = linkText.toLowerCase();
  
  // Reject policy/legal pages
  if (/privacy|cookie|terms|policy|legal|disclaimer|gdpr|условия|политика/i.test(lower)) return false;
  
  // Reject file downloads that aren't application forms
  if (/\.(jpg|jpeg|png|gif|svg|ico|css|js|woff|ttf|eot)(\?|$)/i.test(lower)) return false;
  
  // Reject social media links
  if (/facebook\.com|twitter\.com|instagram\.com|linkedin\.com|youtube\.com|vk\.com|t\.me|tiktok\.com/i.test(lower)) return false;
  
  // Reject anchors (#) and javascript: links
  if (lower.startsWith("javascript:") || lower === "#") return false;
  
  // Reject login/password pages (not application pages)
  if (/login|signin|sign-in|password|forgot|reset/i.test(lower) && !/apply|application|admiss|заявк/i.test(lower)) return false;
  
  // Reject extremely short link text (likely icon-only links)
  if (textLower.length < 2) return false;
  
  // Reject news/blog links
  if (/\/news\/|\/blog\/|\/article\/|\/новост/i.test(lower)) return false;
  
  return true;
}

// ════════════════════════════════════════════════════════
// ACQUISITION STRATEGIES (updated with authenticity checks)
// ════════════════════════════════════════════════════════

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchRaw(url: string, opts: {
  ua?: string; timeout?: number; extraHeaders?: Record<string, string>;
} = {}): Promise<{ html: string; status: number; finalUrl: string }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeout || FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": opts.ua || pickUA(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
        "Accept-Encoding": "identity",
        "Cache-Control": "no-cache",
        ...opts.extraHeaders,
      },
      redirect: "follow",
      signal: ctl.signal,
    });
    const html = await resp.text();
    return { html, status: resp.status, finalUrl: resp.url };
  } finally {
    clearTimeout(timer);
  }
}

async function strategyDirectMultiAttempt(url: string): Promise<{ html: string; status: number } | null> {
  const attempts = [
    { ua: USER_AGENTS[0] },
    { ua: USER_AGENTS[4], extraHeaders: { "Accept": "text/html" } },
    { ua: USER_AGENTS[6], extraHeaders: { "X-Forwarded-For": "66.249.66.1" } },
    { ua: USER_AGENTS[3], extraHeaders: { "Referer": "https://www.google.com/" } },
  ];
  for (let i = 0; i < attempts.length; i++) {
    try {
      const { html, status } = await fetchRaw(url, { ...attempts[i], timeout: FETCH_TIMEOUT_MS });
      if (status >= 200 && status < 400) {
        const text = htmlToText(html);
        const cls = classifyPage(text, html);
        if (cls === "ok" && text.length > 200) return { html, status };
      }
    } catch {}
    if (i < attempts.length - 1) await sleep(500 * (i + 1));
  }
  return null;
}

/** UPDATED: Google cache with authenticity validation */
async function strategyGoogleCache(url: string, expectedDomain: string): Promise<{ html: string; source: string } | null> {
  const cacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}&strip=0`;
  try {
    const { html, status } = await fetchRaw(cacheUrl, { ua: USER_AGENTS[0], timeout: 15_000 });
    if (status !== 200 || html.length < 500) return null;
    
    // Remove Google's cache banner
    const cleaned = html.replace(/^[\s\S]*?<div[^>]*class="[^"]*google[^"]*"[\s\S]*?<\/div>/i, "");
    const text = htmlToText(cleaned.length > 200 ? cleaned : html);
    
    // FIX 3: Authenticity check
    const auth = validateCacheAuthenticity(cleaned.length > 200 ? cleaned : html, text, expectedDomain);
    if (!auth.valid) {
      console.log(`[HARD-v2] ✗ Google cache rejected for ${url}: ${auth.reason}`);
      return null;
    }
    
    return { html: cleaned.length > 200 ? cleaned : html, source: "google_cache" };
  } catch { return null; }
}

/** UPDATED: Wayback with authenticity validation + wrapper cleanup */
async function strategyWaybackMachine(url: string, expectedDomain: string): Promise<{ html: string; source: string; snapshotDate: string } | null> {
  try {
    const checkUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}&timestamp=20260101`;
    const { html: checkResp, status } = await fetchRaw(checkUrl, { timeout: 10_000 });
    if (status !== 200) return null;
    
    const data = JSON.parse(checkResp);
    const snapshot = data?.archived_snapshots?.closest;
    if (!snapshot?.available || !snapshot?.url) return null;
    
    const { html, status: archiveStatus } = await fetchRaw(snapshot.url, { timeout: 15_000 });
    if (archiveStatus !== 200 || html.length < 500) return null;
    
    // FIX 3: Clean Wayback wrapper and validate
    const cleaned = cleanWaybackHtml(html);
    const text = htmlToText(cleaned);
    
    const auth = validateCacheAuthenticity(cleaned, text, expectedDomain);
    if (!auth.valid) {
      console.log(`[HARD-v2] ✗ Wayback rejected for ${url}: ${auth.reason}`);
      return null;
    }
    
    return { html: cleaned, source: "wayback_machine", snapshotDate: snapshot.timestamp || "unknown" };
  } catch { return null; }
}

// ─── HTML/text utilities ───
function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim().replace(/\s+/g, " ") : "";
}

function htmlToText(html: string): string {
  let text = html;
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  text = text.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, content) => {
    return "\n" + "#".repeat(parseInt(level)) + " " + content.replace(/<[^>]*>/g, "").trim() + "\n";
  });
  text = text.replace(/<\/?(p|div|section|article|header|footer|main|aside|nav|ul|ol|li|tr|br|hr)[^>]*>/gi, "\n");
  text = text.replace(/<\/?(td|th)[^>]*>/gi, " | ");
  text = text.replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, "$1");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
  text = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return text;
}

function collectAnchors(html: string, base: string): string[] {
  const out: string[] = [];
  const regex = /<a\s+[^>]*href=["']([^"'#][^"']*)["'][^>]*>/gi;
  for (const m of html.matchAll(regex)) {
    try { out.push(new URL(m[1].trim(), base).href); } catch {}
  }
  return [...new Set(out)];
}

function collectAnchorsWithText(html: string, base: string): Array<{ url: string; text: string }> {
  const out: Array<{ url: string; text: string }> = [];
  const regex = /<a\s+[^>]*href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(regex)) {
    try {
      const abs = new URL(m[1].trim(), base).href;
      const linkText = m[2].replace(/<[^>]*>/g, "").trim();
      if (linkText.length > 0 && linkText.length < 200) out.push({ url: abs, text: linkText });
    } catch {}
  }
  return out;
}

function parseSitemap(xml: string): string[] {
  const out: string[] = [];
  const regex = /<loc>([^<]+)<\/loc>/gi;
  for (const m of xml.matchAll(regex)) out.push(m[1].trim());
  return out;
}

// ─── Extraction ───
interface ExtractedFact {
  fact_group: FactGroup;
  field_name: string;
  value_raw: string;
  evidence_snippet: string;
  confidence: number;
}

function extractFacts(markdown: string, html: string, pageUrl: string, factGroups: FactGroup[], domainFamily: string): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  const md = markdown || "";

  if (factGroups.includes("identity")) {
    const paragraphs = md.split(/\n{2,}/).filter(p => p.length > 100 && !p.startsWith("#") && !p.startsWith("|"));
    if (paragraphs.length > 0) {
      facts.push({ fact_group: "identity", field_name: "description", value_raw: paragraphs[0].trim().slice(0, 2000), evidence_snippet: paragraphs[0].trim().slice(0, 300), confidence: 0.85 });
    }
    const logoMatch = html.match(/<img[^>]+(?:class|id|alt)="[^"]*logo[^"]*"[^>]+src="([^"]+)"/i) || html.match(/<img[^>]+src="([^"]+logo[^"]+)"/i);
    if (logoMatch) {
      try { facts.push({ fact_group: "identity", field_name: "logo", value_raw: new URL(logoMatch[1], pageUrl).href, evidence_snippet: `Logo URL`, confidence: 0.9 }); } catch {}
    }
  }

  if (factGroups.includes("contact_location")) {
    const emailMatch = md.match(/[\w.+-]+@[\w.-]+\.\w{2,}/);
    if (emailMatch) facts.push({ fact_group: "contact_location", field_name: "email", value_raw: emailMatch[0], evidence_snippet: `Email: ${emailMatch[0]}`, confidence: 0.85 });
    
    // FIX 4: Strict phone validation — also extract from HTML tel: links
    const telLinkMatch = html.match(/href="tel:([^"]+)"/i);
    if (telLinkMatch && isValidPhone(telLinkMatch[1])) {
      facts.push({ fact_group: "contact_location", field_name: "phone", value_raw: telLinkMatch[1].trim(), evidence_snippet: `Phone (tel link): ${telLinkMatch[1]}`, confidence: 0.9 });
    } else {
      // Fallback to text regex, but require + prefix or structured format
      const phoneMatch = md.match(/\+\d{1,3}[\s\-]?\(?\d{2,5}\)?[\s\-.]?\d{2,4}[\s\-.]?\d{2,4}[\s\-.]?\d{0,4}/);
      if (phoneMatch && isValidPhone(phoneMatch[0])) {
        facts.push({ fact_group: "contact_location", field_name: "phone", value_raw: phoneMatch[0], evidence_snippet: `Phone: ${phoneMatch[0]}`, confidence: 0.8 });
      }
    }
    
    const addressMatch = md.match(/(?:address|location|campus|адрес|местоположение|кампус)[:\s]*([^\n]{20,150})/i);
    if (addressMatch) facts.push({ fact_group: "contact_location", field_name: "address", value_raw: addressMatch[1].trim(), evidence_snippet: addressMatch[0].slice(0, 200), confidence: 0.7 });
  }

  if (factGroups.includes("admissions")) {
    const gpaMatch = md.match(/(?:GPA|grade.?point|CGPA|средний балл)[:\s]*(\d+\.?\d*)\s*(?:\/\s*\d+)?/i);
    if (gpaMatch) facts.push({ fact_group: "admissions", field_name: "min_gpa", value_raw: gpaMatch[1], evidence_snippet: gpaMatch[0].slice(0, 200), confidence: 0.75 });
    
    // Wide admission requirement block patterns (EN + RU)
    const admPatterns = [
      /(?:admission\s*requirements?|entry\s*requirements?|how\s*to\s*apply|application\s*process|eligibility\s*criteria)[:\s]*([^\n]{10,500})/gi,
      /(?:требования\s*(?:для\s*)?поступлен|условия\s*приём|правила\s*приём|вступительн\w*\s*(?:испытан|экзамен|требован)|порядок\s*поступлен|для\s*иностранн\w*\s*граждан|приём\s*иностранн)[:\s]*([^\n]{10,500})/gi,
      /(?:applicants?\s*(?:must|should|need|are\s*required)|to\s*(?:apply|enroll|be\s*admitted))[,:\s]*([^\n]{10,500})/gi,
    ];
    let admFactCount = 0;
    for (const pattern of admPatterns) {
      const p = new RegExp(pattern.source, pattern.flags);
      for (const arm of [...md.matchAll(p)].slice(0, 3)) {
        const val = (arm[1] || arm[0]).trim();
        if (val.length >= 10) {
          facts.push({ fact_group: "admissions", field_name: "requirements_text", value_raw: val.slice(0, 2000), evidence_snippet: arm[0].slice(0, 300), confidence: 0.8 });
          admFactCount++;
        }
      }
    }
    
    // Broader fallback: find any paragraph near admission keywords
    if (admFactCount === 0) {
      const admKeywords = /(?:admission|requirement|eligibilit|criteria|apply|applicant|enroll|требовани|условия приём|поступлен|приём|вступительн|абитуриент)/i;
      const admMatch = md.match(admKeywords);
      if (admMatch && admMatch.index !== undefined) {
        const snippet = md.substring(Math.max(0, admMatch.index - 50), admMatch.index + 2000);
        facts.push({ fact_group: "admissions", field_name: "requirements_text", value_raw: snippet.slice(0, 2000), evidence_snippet: snippet.slice(0, 300), confidence: 0.6 });
      }
    }
    
    // FIX: Extract from Next.js __NEXT_DATA__ SSG payloads (abit.itmo.ru style)
    const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const scores = nextData?.props?.pageProps?.scores;
        if (Array.isArray(scores) && scores.length > 0) {
          // Extract program count with admission scores
          const recentScores = scores.filter((s: any) => s.year >= 2024);
          const withPassScore = recentScores.filter((s: any) => s.pass_score != null);
          if (withPassScore.length > 0) {
            const summary = withPassScore.slice(0, 10).map((s: any) => 
              `${s.title}: pass_score=${s.pass_score}, avg=${s.average_score || 'N/A'}`
            ).join("; ");
            facts.push({ fact_group: "admissions", field_name: "pass_scores", value_raw: summary.slice(0, 3000), evidence_snippet: `${withPassScore.length} programs with pass scores from __NEXT_DATA__`, confidence: 0.9 });
          }
          
          // Extract tuition fees from contract/contract_foreign fields
          const withFees = scores.filter((s: any) => s.contract != null || s.contract_foreign != null);
          if (withFees.length > 0 && factGroups.includes("tuition_fees")) {
            const feeSummary = withFees.slice(0, 10).map((s: any) => 
              `${s.title}: contract=${s.contract || 'N/A'}, foreign=${s.contract_foreign || 'N/A'} (${s.year})`
            ).join("; ");
            facts.push({ fact_group: "tuition_fees", field_name: "fee_structured", value_raw: feeSummary.slice(0, 3000), evidence_snippet: `${withFees.length} programs with fee data from SSG`, confidence: 0.85 });
          }
          
          // Extract programs inventory from SSG
          if (factGroups.includes("programs")) {
            const uniquePrograms = [...new Set(scores.map((s: any) => s.title))];
            facts.push({ fact_group: "programs", field_name: "programs_catalog", value_raw: uniquePrograms.slice(0, 50).join("; "), evidence_snippet: `${uniquePrograms.length} unique programs from structured SSG data`, confidence: 0.9 });
          }
        }
        
        // Extract key dates from i18n namespaces
        const ns = nextData?.props?.pageProps?.__namespaces;
        if (ns) {
          const admNs = ns.admission || {};
          // Key dates
          const keyDates = admNs.keyDatesBachelor || admNs.keyDatesMasterMaster || {};
          if (typeof keyDates === 'object' && keyDates.description) {
            facts.push({ fact_group: "deadlines_intakes", field_name: "key_dates", value_raw: keyDates.description.slice(0, 2000), evidence_snippet: keyDates.description.slice(0, 300), confidence: 0.85 });
          }
        }
      } catch { /* JSON parse failed, skip */ }
    }
  }

  if (factGroups.includes("deadlines_intakes")) {
    const deadlineMatches = [...md.matchAll(/(?:deadline|last date|срок подачи|приём документов|окончание приёма)[:\s]*([^\n]{5,100})/gi)];
    for (const dm of deadlineMatches.slice(0, 5)) {
      facts.push({ fact_group: "deadlines_intakes", field_name: "deadline", value_raw: dm[1].trim(), evidence_snippet: dm[0].slice(0, 200), confidence: 0.7 });
    }
    const intakeMatch = md.match(/(?:intake|semester|term|fall|spring|набор|семестр|осенний|весенний)[:\s]*([^\n]{5,100})/i);
    if (intakeMatch) facts.push({ fact_group: "deadlines_intakes", field_name: "intake_period", value_raw: intakeMatch[1].trim(), evidence_snippet: intakeMatch[0].slice(0, 200), confidence: 0.7 });
  }

  if (factGroups.includes("tuition_fees")) {
    const currencyPatterns = [
      { currency: "RUB", pattern: /([\d\s.,]+)\s*(?:руб|₽|RUB)/g },
      { currency: "RUB", pattern: /(?:руб|₽|RUB)[.\s]*([\d\s.,]+)/g },
      { currency: "USD", pattern: /\$\s*([\d.,]+)/g },
      { currency: "USD", pattern: /([\d.,]+)\s*(?:USD|US\s*Dollar)/gi },
      { currency: "EUR", pattern: /€\s*([\d.,]+)/g },
    ];
    const feeKeywords = /tuition|fee|cost|price|стоимость|оплата|обучен|плата|за\s*год|за\s*семестр|per\s*year|per\s*semester|annual/i;
    
    for (const { currency, pattern } of currencyPatterns) {
      const p = new RegExp(pattern.source, pattern.flags);
      let match;
      while ((match = p.exec(md)) !== null) {
        const amtStr = match[1].replace(/\s/g, "");
        const numericVal = parseFloat(amtStr.replace(/[.,](?=\d{3})/g, "").replace(",", "."));
        if (isNaN(numericVal) || numericVal < 100 || numericVal > 5000000) continue;
        const ctxStart = Math.max(0, match.index - 120);
        const ctxEnd = Math.min(md.length, match.index + match[0].length + 120);
        const context = md.substring(ctxStart, ctxEnd);
        const nearFee = feeKeywords.test(context);
        facts.push({
          fact_group: "tuition_fees", field_name: "fee_amount",
          value_raw: `${match[0].trim()} (${currency})`,
          evidence_snippet: context.slice(0, 300),
          confidence: nearFee ? 0.75 : 0.5,
        });
      }
    }
    const tableRows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    for (const row of tableRows) {
      const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c => c[1].replace(/<[^>]*>/g, "").trim());
      const rowText = cells.join(" | ");
      if (feeKeywords.test(rowText) && /[\d.,]+/.test(rowText)) {
        facts.push({ fact_group: "tuition_fees", field_name: "fee_table_row", value_raw: rowText.slice(0, 500), evidence_snippet: rowText.slice(0, 300), confidence: 0.75 });
      }
    }
  }

  if (factGroups.includes("scholarships")) {
    const schlMatch = md.match(/(?:scholarship|grant|fellowship|financial.?aid|стипенди|грант|финансов.?помощ)[^]*?(?:\n\n|\n#{1,3}|\Z)/i);
    if (schlMatch) facts.push({ fact_group: "scholarships", field_name: "scholarship_info", value_raw: schlMatch[0].slice(0, 2000), evidence_snippet: schlMatch[0].slice(0, 300), confidence: 0.65 });
  }

  if (factGroups.includes("language_requirements")) {
    const ieltsMatch = md.match(/IELTS[:\s]*(\d+\.?\d*)/i);
    if (ieltsMatch) facts.push({ fact_group: "language_requirements", field_name: "min_ielts", value_raw: ieltsMatch[1], evidence_snippet: ieltsMatch[0].slice(0, 200), confidence: 0.85 });
    const toeflMatch = md.match(/TOEFL[:\s]*(\d+)/i);
    if (toeflMatch) facts.push({ fact_group: "language_requirements", field_name: "min_toefl", value_raw: toeflMatch[1], evidence_snippet: toeflMatch[0].slice(0, 200), confidence: 0.85 });
    
    // Wide language requirement patterns (EN + RU)
    const langPatterns = [
      { field: "language_of_instruction", pattern: /(?:taught\s+(?:exclusively\s+)?in|language\s+of\s+instruction|medium\s+of\s+instruction|instruction\s+language)[:\s]*([^\n,.]{3,80})/i },
      { field: "english_proficiency", pattern: /(?:english\s+(?:language\s+)?(?:proficiency|level|requirement)|level\s+of\s+english)[:\s]*([^\n,.]{3,100})/i },
      { field: "english_proficiency", pattern: /(?:upper[\s-]intermediate|intermediate|advanced|fluent|B1|B2|C1|C2)\s*(?:level\s+(?:of\s+)?)?(?:english|English)/i },
      { field: "language_requirement_text", pattern: /(?:admission\s*requirements?|entry\s*requirements?)[:\s]*[^;]*?(?:english|language)[^;]*?(?:;|$|\n)/i },
      // programs in English / English-taught / English medium
      { field: "language_of_instruction", pattern: /(?:programs?\s+(?:in|taught\s+in)\s+english|english[\s-](?:taught|medium|language)\s+program|программ\w*\s+на\s+английск)/i },
      // Russian language mentions
      { field: "language_requirement_text", pattern: /(?:на\s+(?:английском|русском)\s+языке|language\s+of\s+(?:study|teaching|instruction)\s*(?:is|:)\s*[^\n,.]{3,50})/i },
      // Certificate mentions
      { field: "language_requirement_text", pattern: /(?:(?:IELTS|TOEFL|DELF|DALF|TestDaF|HSK|ТРКИ|TORFL)\s*[^.\n]{5,100})/i },
    ];
    let langFound = false;
    for (const { field, pattern } of langPatterns) {
      const langMatch = md.match(pattern);
      if (langMatch) {
        facts.push({ fact_group: "language_requirements", field_name: field, value_raw: (langMatch[1] || langMatch[0]).trim().slice(0, 500), evidence_snippet: langMatch[0].slice(0, 300), confidence: 0.75 });
        langFound = true;
        break;
      }
    }
    // Broader fallback: any mention of language in context of study/programs
    if (!langFound) {
      const langFallback = md.match(/(?:english|russian|англ\w+|русск\w+)\s*(?:language|программ|program|course|обучен|taught|medium|instruction|преподаван)/i);
      if (langFallback && langFallback.index !== undefined) {
        const snippet = md.substring(Math.max(0, langFallback.index - 30), langFallback.index + 300);
        facts.push({ fact_group: "language_requirements", field_name: "language_requirement_text", value_raw: snippet.trim().slice(0, 500), evidence_snippet: snippet.slice(0, 300), confidence: 0.6 });
      }
    }
  }

  if (factGroups.includes("programs")) {
    const progHeaders = [...md.matchAll(/(?:bachelor|master|phd|doctorate|бакалавр|магистр|аспирант|специалитет|engineering|medicine|law|business|science)[^\n]*/gi)];
    if (progHeaders.length > 0) {
      facts.push({ fact_group: "programs", field_name: "programs_detected", value_raw: `${progHeaders.length} program mentions`, evidence_snippet: progHeaders.slice(0, 5).map(m => m[0].trim().slice(0, 80)).join(" | "), confidence: 0.5 });
    }
  }

  if (factGroups.includes("housing")) {
    const housingMatch = md.match(/(?:dormitor|residence.?hall|student.?housing|hostel|accommodation|on.?campus|общежити|кампус|проживани)/i);
    if (housingMatch) {
      const idx = housingMatch.index || 0;
      const snippet = md.substring(idx, idx + 1000);
      facts.push({ fact_group: "housing", field_name: "housing_info", value_raw: snippet.slice(0, 2000), evidence_snippet: snippet.slice(0, 300), confidence: 0.75 });
    }
  }

  if (factGroups.includes("student_life")) {
    const lifePatterns = [
      /(?:student.?life|campus.?life|студенческ.?жизнь|внеучебн)/i,
      /(?:student\s+club|клуб|student\s+organization|организац)/i,
      /(?:sport|спорт|gym|fitness|recreation)/i,
      /(?:library|библиотек|laboratory|cafeteria|столовая)/i,
    ];
    for (const re of lifePatterns) {
      const match = md.match(re);
      if (match && match.index !== undefined) {
        const snippet = md.substring(match.index, match.index + 1000);
        if (snippet.length > 30) {
          facts.push({ fact_group: "student_life", field_name: "student_life_info", value_raw: snippet.slice(0, 2000), evidence_snippet: snippet.slice(0, 300), confidence: 0.65 });
          break;
        }
      }
    }
  }

  if (factGroups.includes("media_brochures")) {
    // PDF links (both .pdf hrefs and download-like links)
    const pdfLinks = [...html.matchAll(/href="([^"]+\.pdf(?:\?[^"]*)?)"/gi)];
    const downloadLinks = [...html.matchAll(/href="([^"]+(?:download|brochure|prospectus|catalog|каталог|буклет)[^"]*)"/gi)];
    const allMediaLinks = [...pdfLinks, ...downloadLinks];
    if (allMediaLinks.length > 0) {
      const urls = allMediaLinks.map(m => { try { return new URL(m[1], pageUrl).href; } catch { return null; } }).filter(Boolean);
      const unique = [...new Set(urls)];
      if (unique.length > 0) facts.push({ fact_group: "media_brochures", field_name: "brochure_links", value_raw: JSON.stringify(unique.slice(0, 15)), evidence_snippet: `Found ${unique.length} document/PDF links`, confidence: 0.7 });
    }
    // Also check for video embeds
    const videoEmbeds = [...html.matchAll(/(?:src|data-src)="([^"]*(?:youtube\.com\/embed|youtu\.be|rutube\.ru|vimeo\.com)[^"]*)"/gi)];
    if (videoEmbeds.length > 0) {
      facts.push({ fact_group: "media_brochures", field_name: "video_links", value_raw: JSON.stringify(videoEmbeds.slice(0, 5).map(m => m[1])), evidence_snippet: `Found ${videoEmbeds.length} video embeds`, confidence: 0.6 });
    }
  }

  if (factGroups.includes("cta_links")) {
    const links = collectAnchorsWithText(html, pageUrl);
    const ctaPatterns = [
      { field: "apply_url", pattern: /apply|application|enroll|подать.?заявк|поступ|заявлен|приём/i },
      { field: "inquiry_url", pattern: /inquiry|enquiry|info.?request|обратная.?связь|задать.?вопрос/i },
      { field: "contact_url", pattern: /contact|контакт|обратн.?связь/i },
    ];
    const found = new Set<string>();
    for (const { field, pattern } of ctaPatterns) {
      for (const link of links) {
        if (found.has(field)) break;
        if ((pattern.test(link.url) || pattern.test(link.text)) && isWithinDomainFamily(link.url, domainFamily) && isValidCtaLink(link.url, link.text)) {
          facts.push({ fact_group: "cta_links", field_name: field, value_raw: link.url, evidence_snippet: `Link: "${link.text}" → ${link.url}`, confidence: 0.8 });
          found.add(field);
        }
      }
    }
  }

  return facts;
}

// ─── Completeness scoring ───
const SECTION_WEIGHTS: Record<FactGroup, number> = {
  identity: 15, contact_location: 10, admissions: 12, deadlines_intakes: 8,
  tuition_fees: 12, scholarships: 8, language_requirements: 8, programs: 12,
  housing: 5, student_life: 3, media_brochures: 3, cta_links: 4,
};

function computeCompleteness(factsByGroup: Record<string, number>) {
  let totalWeight = 0, earnedWeight = 0;
  const bySection: Record<string, { score: number; weight: number; found: boolean }> = {};
  for (const [group, weight] of Object.entries(SECTION_WEIGHTS)) {
    const found = (factsByGroup[group] || 0) > 0;
    totalWeight += weight;
    if (found) earnedWeight += weight;
    bySection[group] = { score: found ? 100 : 0, weight, found };
  }
  return { overall: totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0, by_section: bySection };
}

// ════════════════════════════════════════════════════════
// MAIN: Process one hard-site university (v2.0)
// ════════════════════════════════════════════════════════

async function processHardSite(
  db: ReturnType<typeof supaAdmin>,
  row: any,
  traceId: string,
): Promise<any> {
  const { id: rowId, university_id, website, university_name, job_id } = row;
  const officialDomain = getOfficialDomain(website);
  if (!officialDomain) return { university: university_name, status: "invalid_domain" };

  const startTime = Date.now();
  const normalizedUrl = website.startsWith("http") ? website : `https://${website}`;
  const rootDomain = officialDomain.replace(/^www\./, "");
  const strategyLog: any[] = [];

  await db.from("official_site_crawl_rows").update({
    crawl_status: "fetching", locked_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq("id", rowId);

  try {
    // ═══ PHASE 1: Subdomain family discovery ═══
    console.log(`[HARD-v2] Phase 1: Subdomain discovery for ${university_name} (${rootDomain})`);
    const subdomainResults = await discoverSubdomainFamily(rootDomain);
    const entrypoints = chooseEntrypoints(subdomainResults);
    
    strategyLog.push({
      phase: "subdomain_discovery",
      probed: subdomainResults.length,
      live_subdomains: subdomainResults.map(r => ({
        subdomain: r.subdomain, url: r.url, score: r.score, purpose: r.purpose, pageType: r.pageType, title: r.title.slice(0, 80),
      })),
      chosen: {
        identity: entrypoints.identity?.url || null,
        admissions: entrypoints.admissions?.url || null,
        programs: entrypoints.programs?.url || null,
        fees: entrypoints.fees?.url || null,
        contact: entrypoints.contact?.url || null,
        housing: entrypoints.housing?.url || null,
      },
    });

    // If no live subdomains at all, fall back to old strategies
    if (subdomainResults.length === 0) {
      console.log(`[HARD-v2] No live subdomains found, falling back to legacy acquisition`);
      // Try direct multi-attempt on root
      const direct = await strategyDirectMultiAttempt(normalizedUrl);
      if (!direct) {
        // Try cache/archive as last resort
        const cached = await strategyGoogleCache(normalizedUrl, rootDomain);
        if (cached) {
          subdomainResults.push({
            url: normalizedUrl, subdomain: "(root-cache)", purpose: "cache_fallback",
            categories: ["identity"], status: 200, contentLength: cached.html.length,
            title: extractTitle(cached.html), pageType: "ok", score: 20,
          });
        }
      }
    }

    if (subdomainResults.length === 0) {
      await db.from("official_site_crawl_rows").update({
        crawl_status: "special",
        reason_codes: ["HARD_SITE_ALL_STRATEGIES_FAILED"],
        coverage_result: { strategies: strategyLog, acquisition: "hard_sites_v2", elapsed_ms: Date.now() - startTime },
        updated_at: new Date().toISOString(),
      }).eq("id", rowId);
      return { university: university_name, status: "all_strategies_failed", strategies: strategyLog };
    }

    // ═══ PHASE 2: Crawl all live entrypoints ═══
    console.log(`[HARD-v2] Phase 2: Crawling ${subdomainResults.length} entrypoints`);
    
    await db.from("official_site_crawl_rows").update({
      crawl_status: "extracting", updated_at: new Date().toISOString(),
    }).eq("id", rowId);

    const observations: any[] = [];
    const factsByGroup: Record<string, number> = {};
    const fetchedAt = new Date().toISOString();
    let pagesScraped = 0;
    let antiBotPages = 0;
    let jsOnlyPages = 0;
    const pagesLog: Array<{ url: string; source: string; facts: number; pageType: string }> = [];

    // Collect all links from all live entrypoints
    const allDiscoveredLinks = new Set<string>();
    
    for (const entry of subdomainResults.filter(r => r.score >= 30)) {
      if (Date.now() - startTime > TIME_BUDGET_MS) break;
      
      try {
        const { html, status } = await fetchRaw(entry.url, { timeout: FETCH_TIMEOUT_MS });
        if (status < 200 || status >= 400) continue;
        
        const text = htmlToText(html);
        const cls = classifyPage(text, html);
        
        if (cls === "hard_block" || cls === "cloudflare") { antiBotPages++; continue; }
        if (cls === "js_only") {
          jsOnlyPages++;
          if (text.length < 100) continue;
        }
        if (cls === "empty") continue;
        
        pagesScraped++;
        const title = extractTitle(html);
        
        // Determine which fact groups this entrypoint is good for
        const relevantGroups = new Set<FactGroup>();
        for (const cat of entry.categories) {
          for (const dc of DISCOVERY_CATEGORIES) {
            if (dc.category === cat) dc.factGroups.forEach(fg => relevantGroups.add(fg));
          }
        }
        // Always try identity + contact on any page
        relevantGroups.add("identity");
        relevantGroups.add("contact_location");
        
        const pageFacts = extractFacts(text, html, entry.url, [...relevantGroups], rootDomain);
        let pageFactCount = 0;
        
        for (const fact of pageFacts) {
          const sourceTier: SourceTier = "live";
          const verifyTier = getVerifyTier(fact.fact_group as FactGroup, sourceTier);
          if (verifyTier === "never_publish") continue;
          factsByGroup[fact.fact_group] = (factsByGroup[fact.fact_group] || 0) + 1;
          pageFactCount++;
          observations.push({
            job_id, row_id: rowId, university_id,
            field_name: fact.field_name, fact_group: fact.fact_group,
            value_raw: fact.value_raw.slice(0, 5000),
            evidence_snippet: fact.evidence_snippet.slice(0, 500),
            source_url: entry.url, page_title: title || null,
            source_type: "official_website",
            confidence: fact.confidence,
            verify_tier: verifyTier,
            source_tier: sourceTier,
            trace_id: traceId, entity_type: "university", status: "new",
            fetched_at: fetchedAt, extracted_at: fetchedAt, parser_version: PARSER_VERSION,
          });
        }
        
        pagesLog.push({ url: entry.url, source: `subdomain_live(${entry.subdomain})`, facts: pageFactCount, pageType: cls });
        
        // Collect sub-links from this entrypoint
        const anchors = collectAnchors(html, entry.url);
        anchors.filter(u => isWithinDomainFamily(u, rootDomain)).forEach(u => allDiscoveredLinks.add(u));
        
      } catch {}
    }

    // ═══ PHASE 3: Crawl discovered sub-pages from all entrypoints ═══
    console.log(`[HARD-v2] Phase 3: ${allDiscoveredLinks.size} discovered links across all subdomains`);
    
    // Inject high-value deep page probes based on known patterns for SSR sites
    // These are common paths on institutional English portals (en.*.ru style)
    const liveOrigins = new Set(subdomainResults.filter(r => r.score >= 30).map(r => {
      try { return new URL(r.url).origin; } catch { return null; }
    }).filter(Boolean) as string[]);
    
    const deepProbes = [
      // Admissions / programs pages (server-rendered, high-value)
      "/en/page/114/Admission.htm",
      "/en/page/295/Programs.htm",
      "/en/page/310/International_Master's_Programs.htm",
      "/en/admission",
      "/en/programs",
      "/en/bachelor",
      "/en/master",
      "/en/phd",
      "/en/tuition",
      "/en/scholarships",
      "/en/fees",
      // Russian admissions portal deep pages
      "/bachelor",
      "/master",
      "/phd",
      "/en/foundation_program",
      "/en/opportunities_for_applicants",
    ];
    
    for (const origin of liveOrigins) {
      for (const probe of deepProbes) {
        allDiscoveredLinks.add(origin + probe);
      }
    }
    
    // Also try sitemaps from all live subdomains
    for (const origin of liveOrigins) {
      if (Date.now() - startTime > TIME_BUDGET_MS) break;
      try {
        const { html: sxml, status } = await fetchRaw(`${origin}/sitemap.xml`, { timeout: 8_000 });
        if (status === 200 && sxml.includes("<loc>")) {
          parseSitemap(sxml).filter(u => isWithinDomainFamily(u, rootDomain)).forEach(u => allDiscoveredLinks.add(u));
        }
      } catch {}
    }
    
    // Categorize and prioritize
    const alreadyScraped = new Set(pagesLog.map(p => p.url.replace(/\/+$/, "").toLowerCase()));
    const categorized = [...allDiscoveredLinks]
      .filter(url => !alreadyScraped.has(url.replace(/\/+$/, "").toLowerCase()))
      .map(url => {
        const combinedText = url.toLowerCase();
        for (const cat of DISCOVERY_CATEGORIES) {
          if (cat.keywords.test(combinedText)) {
            return { url, category: cat.category, factGroups: cat.factGroups };
          }
        }
        return null; // skip uncategorized links
      })
      .filter(Boolean) as Array<{ url: string; category: string; factGroups: FactGroup[] }>;

    const priority = ["fees", "admissions", "scholarships", "cta", "international", "housing", "language", "programs", "contact", "about", "student_life", "deadlines", "media"];
    categorized.sort((a, b) => priority.indexOf(a.category) - priority.indexOf(b.category));
    const subPagesToFetch = categorized.slice(0, MAX_PAGES - pagesScraped);

    for (const page of subPagesToFetch) {
      if (Date.now() - startTime > TIME_BUDGET_MS) break;
      
      try {
        const { html, status } = await fetchRaw(page.url, { timeout: FETCH_TIMEOUT_MS });
        if (status < 200 || status >= 400) continue;
        
        const text = htmlToText(html);
        const cls = classifyPage(text, html);
        
        if (cls === "hard_block" || cls === "cloudflare") { antiBotPages++; continue; }
        if (cls === "js_only") {
          jsOnlyPages++;
          // For high-value JS-only pages, try Google cache with authenticity check
          if (["fees", "admissions", "scholarships"].includes(page.category)) {
            const cached = await strategyGoogleCache(page.url, rootDomain);
            if (cached) {
              const cachedMd = htmlToText(cached.html);
              const cachedTitle = extractTitle(cached.html);
              const cachedFacts = extractFacts(cachedMd, cached.html, page.url, page.factGroups, rootDomain);
              let cachedFactCount = 0;
              for (const fact of cachedFacts) {
                const cVerifyTier = getVerifyTier(fact.fact_group as FactGroup, "google_cache");
                if (cVerifyTier === "never_publish") continue;
                factsByGroup[fact.fact_group] = (factsByGroup[fact.fact_group] || 0) + 1;
                cachedFactCount++;
                observations.push({
                  job_id, row_id: rowId, university_id,
                  field_name: fact.field_name, fact_group: fact.fact_group,
                  value_raw: fact.value_raw.slice(0, 5000),
                  evidence_snippet: fact.evidence_snippet.slice(0, 500),
                  source_url: page.url, page_title: cachedTitle || null,
                  source_type: "official_website_google_cache",
                  confidence: fact.confidence * 0.9,
                  verify_tier: cVerifyTier,
                  source_tier: "google_cache" as SourceTier,
                  trace_id: traceId, entity_type: "university", status: "new",
                  fetched_at: fetchedAt, extracted_at: fetchedAt, parser_version: PARSER_VERSION,
                });
              }
              pagesScraped++;
              pagesLog.push({ url: page.url, source: "google_cache", facts: cachedFactCount, pageType: "cached" });
              continue;
            }
          }
          if (text.length < 100) continue;
        }
        if (cls === "empty") continue;

        pagesScraped++;
        // Widen fact groups for all subpages to catch cross-cutting data
        // (e.g., admission page often has language requirements and media links)
        const wideGroups = new Set<FactGroup>([...page.factGroups, "language_requirements", "admissions", "media_brochures"]);
        const facts = extractFacts(text, html, page.url, [...wideGroups], rootDomain);
        let pageFactCount = 0;
        for (const fact of facts) {
          const sTier: SourceTier = "live";
          const vTier = getVerifyTier(fact.fact_group as FactGroup, sTier);
          if (vTier === "never_publish") continue;
          factsByGroup[fact.fact_group] = (factsByGroup[fact.fact_group] || 0) + 1;
          pageFactCount++;
          observations.push({
            job_id, row_id: rowId, university_id,
            field_name: fact.field_name, fact_group: fact.fact_group,
            value_raw: fact.value_raw.slice(0, 5000),
            evidence_snippet: fact.evidence_snippet.slice(0, 500),
            source_url: page.url, page_title: extractTitle(html) || null,
            source_type: "official_website",
            confidence: fact.confidence,
            verify_tier: vTier,
            source_tier: sTier,
            trace_id: traceId, entity_type: "university", status: "new",
            fetched_at: fetchedAt, extracted_at: fetchedAt, parser_version: PARSER_VERSION,
          });
        }
        pagesLog.push({ url: page.url, source: "live", facts: pageFactCount, pageType: cls });
      } catch {}
    }

    // Save observations
    if (observations.length > 0) {
      const CHUNK = 50;
      for (let i = 0; i < observations.length; i += CHUNK) {
        await db.from("official_site_observations").insert(observations.slice(i, i + CHUNK));
      }
    }

    // Compute completeness
    const completeness = computeCompleteness(factsByGroup);
    const missingSections = FACT_GROUPS.filter(g => !factsByGroup[g]);
    const reasonCodes: string[] = [];
    if (Object.keys(factsByGroup).length === 0) reasonCodes.push("NO_DATA_EXTRACTED");
    if (!factsByGroup["tuition_fees"]) reasonCodes.push("MISSING_FEES");
    if (!factsByGroup["programs"]) reasonCodes.push("MISSING_PROGRAMS");
    if (antiBotPages > 0) reasonCodes.push("ANTI_BOT_PAGE");
    if (jsOnlyPages > 0) reasonCodes.push("JS_ONLY_PAGE");

    const stillSpecial = Object.keys(factsByGroup).length === 0;
    const mappedStatus = stillSpecial ? "special" : "verifying";

    await db.from("official_site_crawl_rows").update({
      crawl_status: mappedStatus,
      completeness_score: completeness.overall,
      completeness_by_section: completeness.by_section,
      pages_scraped: pagesScraped,
      pages_mapped: subPagesToFetch.length + subdomainResults.filter(r => r.score >= 30).length,
      discovery_passes: strategyLog,
      coverage_result: {
        facts_by_group: factsByGroup,
        missing_sections: missingSections,
        anti_bot_pages: antiBotPages,
        js_only_pages: jsOnlyPages,
        subdomains_found: subdomainResults.length,
        pages_log: pagesLog,
        acquisition: "hard_sites_v2",
        elapsed_ms: Date.now() - startTime,
      },
      reason_codes: reasonCodes.length > 0 ? reasonCodes : null,
      updated_at: new Date().toISOString(),
    }).eq("id", rowId);

    if (!stillSpecial) {
      await db.from("official_site_special_queue").delete().eq("university_id", university_id);
    }

    console.log(`[HARD-v2] ✅ ${university_name}: ${observations.length} facts, completeness=${completeness.overall}%, pages=${pagesScraped}, subdomains=${subdomainResults.length}`);
    return {
      university: university_name,
      status: mappedStatus,
      completeness: completeness.overall,
      facts: observations.length,
      pages_scraped: pagesScraped,
      subdomains_found: subdomainResults.length,
      entrypoints_chosen: {
        identity: entrypoints.identity?.url || null,
        admissions: entrypoints.admissions?.url || null,
        programs: entrypoints.programs?.url || null,
        fees: entrypoints.fees?.url || null,
      },
      strategies: strategyLog,
      fact_groups: factsByGroup,
      pages_log: pagesLog,
      missing_sections: FACT_GROUPS.filter(g => !factsByGroup[g]),
      observations_detail: observations.map(o => ({
        fact_group: o.fact_group, field: o.field_name, value: o.value_raw?.slice(0, 200),
        source: o.source_tier, verify: o.verify_tier, url: o.source_url,
      })),
    };

  } catch (err: any) {
    console.error(`[HARD-v2] ❌ ${university_name}: ${err.message}`);
    await db.from("official_site_crawl_rows").update({
      crawl_status: "failed",
      error_message: err.message?.slice(0, 500),
      reason_codes: ["HARD_SITE_ERROR"],
      updated_at: new Date().toISOString(),
    }).eq("id", rowId);
    return { university: university_name, status: "error", error: err.message };
  }
}

// ─── Main Handler ───
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "content-type": "application/json" } });
    
    let authorized = false;
    if (token === SERVICE_ROLE_KEY) authorized = true;
    else {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload.role === "service_role") authorized = true;
      } catch {}
    }
    if (!authorized) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "content-type": "application/json" } });

    const body = await req.json();
    const { job_id, university_ids, max_rows = 5 } = body;

    if (!job_id) throw new Error("job_id required");

    const db = supaAdmin();
    const traceId = `HARD-v2-${Date.now()}`;

    let query = db.from("official_site_crawl_rows")
      .select("*")
      .eq("job_id", job_id)
      .in("crawl_status", ["special", "failed"])
      .order("university_name")
      .limit(max_rows);

    if (university_ids && university_ids.length > 0) {
      query = query.in("university_id", university_ids);
    }

    const { data: rows, error: rowsErr } = await query;
    if (rowsErr) throw new Error(`Query failed: ${rowsErr.message}`);
    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ done: true, message: "No special/failed rows to retry" }), { headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    console.log(`[HARD-v2] Processing ${rows.length} hard sites for job ${job_id}`);

    const results: any[] = [];
    for (const row of rows) {
      const result = await processHardSite(db, row, traceId);
      results.push(result);
    }

    const improved = results.filter(r => r.status === "verifying");
    const stillFailed = results.filter(r => r.status === "special" || r.status === "all_strategies_failed" || r.status === "error");

    return new Response(JSON.stringify({
      ok: true,
      trace_id: traceId,
      parser_version: PARSER_VERSION,
      lane: "hard_sites_v2",
      source_policy: "official_only",
      acquisition: "free_local_subdomain_family",
      fixes_applied: [
        "subdomain_family_discovery",
        "entrypoint_scoring",
        "cache_authenticity_validation",
        "strict_phone_validation",
        "strict_cta_validation",
      ],
      total: results.length,
      improved: improved.length,
      still_failed: stillFailed.length,
      results,
    }), { headers: { ...corsHeaders, "content-type": "application/json" } });

  } catch (err: any) {
    console.error("[HARD-v2] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
  }
});
