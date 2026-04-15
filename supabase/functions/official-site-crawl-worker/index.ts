import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-client-trace-id, x-orxya-ingress, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function supaAdmin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ─── Config ───
const DEFAULT_MAX_PAGES = 20;
const TIME_BUDGET_MS = 55_000;
const BATCH_SIZE = 10;
const PARSER_VERSION = "osc-v4.6-parsing-fix";
const FETCH_TIMEOUT_MS = 12_000;

// ─── UA Rotation for anti-bot resilience ───
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
  "LavistaBot/1.0 (+https://cswworld.com; educational-data)",
];
function pickUA(): string { return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]; }

// ─── 12 Fact Groups ───
const FACT_GROUPS = [
  "identity", "contact_location", "admissions", "deadlines_intakes",
  "tuition_fees", "scholarships", "language_requirements", "programs",
  "housing", "student_life", "media_brochures", "cta_links",
] as const;
type FactGroup = typeof FACT_GROUPS[number];

// ─── Multi-pass discovery keyword sets ───
const DISCOVERY_CATEGORIES: Array<{ keywords: RegExp; category: string; factGroups: FactGroup[] }> = [
  // Language MUST come first — URLs like /courses/english-language-requirements contain both "requirement" and "english-language"
  { keywords: /ielts|toefl|english.?language|language.?requirement|language.?proficiency|duolingo|pte.?academic|cefr|english.?proficiency/i, category: "language", factGroups: ["language_requirements"] },
  { keywords: /about|overview|profile|mission|history|hakkımızda|hakkimizda|о-нас|rector|president|chancellor|facts.?and.?figures/i, category: "about", factGroups: ["identity", "contact_location"] },
  { keywords: /admission|apply|requirement|entry|başvuru|basvuru|поступлен|прием|kabul|visa/i, category: "admissions", factGroups: ["admissions", "deadlines_intakes", "cta_links"] },
  { keywords: /tuition|fee|cost|price|ücret|ucret|стоимость|оплат|financi|harç|harc/i, category: "fees", factGroups: ["tuition_fees", "scholarships"] },
  { keywords: /program|course|curricul|degree|бакалавриат|магистратура|lisans|bölüm|bolum|programs?.in.english|bachelor|master/i, category: "programs", factGroups: ["programs"] },
  { keywords: /scholarship|burs|financial.?aid|стипенди/i, category: "scholarships", factGroups: ["scholarships", "tuition_fees"] },
  { keywords: /accommodat|housing|dormitor|hostel|общежити|проживан|residence|yurt|living.?cost/i, category: "housing", factGroups: ["housing"] },
  { keywords: /international|foreign|overseas|exchange|yabancı|yabanci|uluslararası|uluslararasi/i, category: "international", factGroups: ["admissions", "language_requirements", "tuition_fees"] },
  { keywords: /facult|department|institut|school|факультет|кафедр|academic|fakülte|fakulte/i, category: "academics", factGroups: ["programs"] },
  { keywords: /contact|address|phone|карт|контакт|location|iletişim|iletisim/i, category: "contact", factGroups: ["contact_location", "cta_links"] },
  { keywords: /student.?life|club|sport|facilit|campus.?life|activit|öğrenci|ogrenci|sosyal|social/i, category: "student_life", factGroups: ["student_life"] },
  { keywords: /deadline|intake|calendar|academic.?year|semester|dönem|donem|takvim/i, category: "deadlines", factGroups: ["deadlines_intakes"] },
  { keywords: /brochure|download|media|gallery|photo|video|tanıtım|tanitim/i, category: "media", factGroups: ["media_brochures"] },
  { keywords: /apply.?online|inquiry|registration|kayıt|kayit|başvur|basvur|register|online.?form/i, category: "cta", factGroups: ["cta_links", "deadlines_intakes"] },
];

// ─── Anti-bot detection (improved: classify JS-only vs true block) ───
const HARD_BLOCK_PATTERNS = [
  /captcha/i, /verify you are human/i, /access denied/i,
  /checking your browser/i, /attention required/i, /bot detection/i,
  /security check/i, /you have been blocked/i,
  /are you a robot/i, /blocked by/i, /403 forbidden/i,
];
const JS_ONLY_PATTERNS = [
  /please enable javascript/i, /javascript is required/i,
  /this page requires javascript/i, /noscript/i,
  /react-root|__next|ng-app|app-root/i,
];
const CLOUDFLARE_PATTERNS = [
  /just a moment/i, /cloudflare/i, /ray id/i, /one more step/i,
];

interface PageClassification {
  type: "ok" | "js_only" | "hard_block" | "cloudflare" | "empty";
}

function classifyPage(text: string, html: string): PageClassification {
  if (!text || text.length < 20) return { type: "empty" };
  const snippet = text.slice(0, 3000).toLowerCase();
  const htmlSnippet = html.slice(0, 5000).toLowerCase();
  
  // Check Cloudflare specifically
  if (CLOUDFLARE_PATTERNS.filter(p => p.test(snippet)).length >= 2) return { type: "cloudflare" };
  if (HARD_BLOCK_PATTERNS.filter(p => p.test(snippet)).length >= 1) return { type: "hard_block" };
  
  // JS-only SPA: very little text content but has JS framework markers
  const isJsOnly = JS_ONLY_PATTERNS.some(p => p.test(htmlSnippet));
  const tooShort = text.length < 300;
  if (isJsOnly || (tooShort && htmlSnippet.includes("<script"))) return { type: "js_only" };
  
  return { type: "ok" };
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

function isWithinDomain(pageUrl: string, officialDomain: string): boolean {
  try {
    const host = new URL(pageUrl).hostname.toLowerCase();
    return host === officialDomain || host.endsWith(`.${officialDomain}`);
  } catch { return false; }
}

// ══════════════════════════════════════════════════════════════════
// FREE/LOCAL ACQUISITION LAYER — no external paid APIs
// ══════════════════════════════════════════════════════════════════

/** Fetch raw HTML with UA rotation + resilient headers */
async function fetchHTML(url: string, retryWithAlt = false): Promise<{ html: string; status: number; redirectUrl: string }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": pickUA(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,tr;q=0.8,ar;q=0.7",
        "Accept-Encoding": "identity",
        "Cache-Control": "no-cache",
        ...(retryWithAlt ? { "Cookie": "" } : {}),
      },
      redirect: "follow",
      signal: ctl.signal,
    });
    const html = await resp.text();
    return { html, status: resp.status, redirectUrl: resp.url };
  } finally {
    clearTimeout(timer);
  }
}

/** Retry fetch with different strategy for JS/blocked pages */
async function fetchWithFallback(url: string, officialDomain: string): Promise<{ html: string; title: string; markdown: string; status: number; classification: PageClassification }> {
  // Attempt 1: direct fetch
  let { html, status } = await fetchHTML(url);
  let md = htmlToText(html);
  let title = extractTitle(html);
  let cls = classifyPage(md, html);
  
  if (cls.type === "ok") return { html, title, markdown: md, status, classification: cls };
  
  // Attempt 2: try /en/ prefix if Turkish site
  if ((cls.type === "js_only" || cls.type === "cloudflare") && !url.includes("/en/") && !url.includes("/en.")) {
    const enUrl = url.replace(officialDomain, officialDomain + "/en").replace(/\/en\/+/g, "/en/");
    try {
      const alt = await fetchHTML(enUrl, true);
      if (alt.status >= 200 && alt.status < 400) {
        const altMd = htmlToText(alt.html);
        const altCls = classifyPage(altMd, alt.html);
        if (altCls.type === "ok" && altMd.length > md.length) {
          return { html: alt.html, title: extractTitle(alt.html), markdown: altMd, status: alt.status, classification: altCls };
        }
      }
    } catch { /* fallback failed */ }
  }
  
  // Attempt 3: retry with different UA
  try {
    const retry = await fetchHTML(url, true);
    const retryMd = htmlToText(retry.html);
    const retryCls = classifyPage(retryMd, retry.html);
    if (retryCls.type === "ok" || retryMd.length > md.length * 1.5) {
      return { html: retry.html, title: extractTitle(retry.html), markdown: retryMd, status: retry.status, classification: retryCls };
    }
  } catch { /* retry failed */ }
  
  return { html, title, markdown: md, status, classification: cls };
}

/** Extract page title from HTML */
function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim().replace(/\s+/g, " ") : "";
}

/** Extract main content HTML by isolating <main>, <article>, or content divs.
 *  This strips sidebar/nav/footer/header noise before any text conversion. */
function extractMainContentHtml(html: string): string {
  // Strategy 1: <main id="content"> or <main>
  const mainMatch = html.match(/<main[^>]*id=["']content["'][^>]*>([\s\S]*?)<\/main>/i)
    || html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch && mainMatch[1].length > 200) return mainMatch[1];

  // Strategy 2: <article> block
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch && articleMatch[1].length > 200) return articleMatch[1];

  // Strategy 3: content div patterns (col-md-9, #content_page, .content_page, role=main)
  const contentDivPatterns = [
    /<div[^>]*class="[^"]*content_page[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i,
    /<div[^>]*id="content_page"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*role=["']main["'][^>]*>([\s\S]*?)<\/div>/i,
  ];
  for (const p of contentDivPatterns) {
    const m = html.match(p);
    if (m && m[1].length > 200) return m[1];
  }

  // Fallback: strip nav/header/footer/aside and return the rest
  return html;
}

/** Parse HTML tables directly into structured rows (bypasses markdown conversion entirely).
 *  Returns array of tables, each table is array of rows, each row is array of cell texts. */
function extractHtmlTableRows(html: string): string[][][] {
  const tables: string[][][] = [];
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  for (const tm of html.matchAll(tableRegex)) {
    const tableHtml = tm[1];
    const rows: string[][] = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    for (const rm of tableHtml.matchAll(rowRegex)) {
      const rowHtml = rm[1];
      const cells: string[] = [];
      const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      for (const cm of rowHtml.matchAll(cellRegex)) {
        // Extract colspan from the opening tag
        const openTag = cm[0].match(/<t[dh]([^>]*)>/i)?.[1] || "";
        const colspanMatch = openTag.match(/colspan\s*=\s*"?(\d+)"?/i);
        const colspan = colspanMatch ? parseInt(colspanMatch[1], 10) : 1;
        const cellText = cm[1]
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<li[^>]*>/gi, "\n• ")
          .replace(/<\/li>/gi, "")
          .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "$1")
          .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "$1")
          .replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, "$1")
          .replace(/<[^>]+>/g, " ")
          .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
          .replace(/\u00a0/g, " ")
          .replace(/\s+/g, " ").trim();
        cells.push(cellText);
        // If colspan > 1, mark with empty cells to maintain column alignment
        for (let i = 1; i < colspan; i++) cells.push("");
      }
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length > 1) tables.push(rows);
  }
  return tables;
}

/** Convert HTML to text, preserving links for CTA extraction.
 *  stripNav=true removes <nav>, <header>, <footer>, <aside> blocks first
 *  to prevent sidebar/menu text from polluting main content extraction. */
function htmlToText(html: string, opts?: { stripNav?: boolean }): string {
  let text = html;
  // Use main content isolation first if stripNav requested
  if (opts?.stripNav) {
    text = extractMainContentHtml(text);
    // Also strip remaining nav/aside within the main content
    text = text.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "");
    text = text.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "");
    text = text.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");
    text = text.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "");
    text = text.replace(/<[^>]+class="[^"]*(?:breadcrumb|menu|sidebar|nav-|top-bar|site-header|site-footer)[^"]*"[^>]*>[\s\S]*?<\/(?:div|ul|ol|section|nav)>/gi, "");
  }
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  text = text.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, content) => {
    return "\n" + "#".repeat(parseInt(level)) + " " + content.replace(/<[^>]*>/g, "").trim() + "\n";
  });
  text = text.replace(/<\/?(p|div|section|article|header|footer|main|aside|nav|ul|ol|li|tr|br|hr)[^>]*>/gi, "\n");
  // Keep table cells with separator
  text = text.replace(/<\/?(td|th)[^>]*>/gi, " | ");
  text = text.replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, "$1");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
  text = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return text;
}

/** Collect all anchor hrefs from HTML */
function collectAnchors(html: string, base: string): string[] {
  const out: string[] = [];
  const regex = /<a\s+[^>]*href=["']([^"'#][^"']*)["'][^>]*>/gi;
  for (const m of html.matchAll(regex)) {
    try {
      const abs = new URL(m[1].trim(), base).href;
      out.push(abs);
    } catch { /* skip bad URLs */ }
  }
  return [...new Set(out)];
}

/** Collect anchors with their visible text (for CTA extraction) */
function collectAnchorsWithText(html: string, base: string): Array<{ url: string; text: string }> {
  const out: Array<{ url: string; text: string }> = [];
  const regex = /<a\s+[^>]*href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(regex)) {
    try {
      const abs = new URL(m[1].trim(), base).href;
      const linkText = m[2].replace(/<[^>]*>/g, "").trim();
      if (linkText.length > 0 && linkText.length < 200) {
        out.push({ url: abs, text: linkText });
      }
    } catch { /* skip */ }
  }
  return out;
}

function parseSitemap(xml: string): string[] {
  const out: string[] = [];
  const regex = /<loc>([^<]+)<\/loc>/gi;
  for (const m of xml.matchAll(regex)) out.push(m[1].trim());
  return out;
}

async function fetchSitemapLinks(baseUrl: string): Promise<string[]> {
  const links: string[] = [];
  for (const path of ["/sitemap.xml", "/sitemap_index.xml", "/sitemap-index.xml"]) {
    try {
      const { html, status } = await fetchHTML(baseUrl + path);
      if (status === 200 && html.includes("<loc>")) {
        const locs = parseSitemap(html);
        const childSitemaps = locs.filter(u => u.endsWith(".xml"));
        if (childSitemaps.length > 0) {
          for (const child of childSitemaps.slice(0, 3)) {
            try {
              const { html: childHtml, status: cs } = await fetchHTML(child);
              if (cs === 200) parseSitemap(childHtml).forEach(u => links.push(u));
            } catch { /* skip */ }
          }
        }
        locs.filter(u => !u.endsWith(".xml")).forEach(u => links.push(u));
      }
    } catch { /* sitemap not found */ }
  }
  return links;
}

/**
 * Multi-pass link discovery — improved:
 * 1. Homepage anchors
 * 2. Sitemap.xml
 * 3. Common institutional paths (expanded for TR)
 * 4. Second-level discovery: follow key category pages for deeper links
 */
async function discoverOfficialPages(
  normalizedUrl: string,
  officialDomain: string,
  maxPages: number,
  startTime: number,
): Promise<{ pages: Array<{ url: string; category: string; factGroups: FactGroup[] }>; passResults: any[]; homepageHtml: string }> {
  const allLinks = new Set<string>();
  const passResults: any[] = [];
  let homepageHtml = "";

  // Pass 1: Homepage anchors
  try {
    const { html, status } = await fetchHTML(normalizedUrl);
    if (status >= 200 && status < 400) {
      homepageHtml = html;
      const anchors = collectAnchors(html, normalizedUrl);
      const official = anchors.filter(u => isWithinDomain(u, officialDomain));
      official.forEach(u => allLinks.add(u));
      passResults.push({ method: "homepage_anchors", found: official.length });
    }
  } catch (e: any) {
    passResults.push({ method: "homepage_anchors", found: 0, error: e.message?.slice(0, 100) });
  }

  // Pass 2: Sitemap
  if (Date.now() - startTime < TIME_BUDGET_MS * 0.2) {
    try {
      const sitemapLinks = await fetchSitemapLinks(normalizedUrl);
      const official = sitemapLinks.filter(u => isWithinDomain(u, officialDomain));
      official.forEach(u => allLinks.add(u));
      passResults.push({ method: "sitemap", found: official.length });
    } catch (e: any) {
      passResults.push({ method: "sitemap", found: 0, error: e.message?.slice(0, 100) });
    }
  }

  // Pass 3: Common institutional paths (expanded)
  const commonPaths = [
    "/about", "/admissions", "/admission", "/tuition", "/fees", "/programs", "/academics",
    "/faculties", "/scholarships", "/financial-aid", "/international", "/student-life",
    "/housing", "/dormitories", "/contact", "/apply", "/deadlines", "/campus",
    // Leadership pages (rector/president/chancellor/vice-chancellor)
    "/about/leadership", "/about/president", "/about/chancellor", "/about/vice-chancellor",
    "/leadership", "/president", "/chancellor", "/office-of-the-president",
    "/about/university-leadership", "/about/senior-leadership",
    "/about/leadership/president", "/about/leadership/chancellor",
    // Language requirement pages
    "/english-language-requirements", "/courses/english-language-requirements",
    "/study/international/english-language", "/international/english-language-requirements",
    "/admissions/english-language-requirements", "/study/english-language-requirements",
    // Turkish variants  
    "/hakkimizda", "/basvuru", "/bolumler", "/burslar", "/ucretler", "/iletisim",
    "/yabanci-ogrenci", "/uluslararasi", "/kampus-yasami", "/akademik-takvim",
    "/kayit", "/ogrenci-yasami", "/yurt", "/sosyal-yasam",
    "/rektor", "/en/rektor", "/en/rector",
    // English subsite for Turkish universities
    "/en", "/en/about", "/en/admissions", "/en/programs", "/en/fees", "/en/contact",
    "/en/scholarships", "/en/student-life", "/en/housing", "/en/international",
    "/en/apply", "/en/tuition", "/en/faculties", "/en/academics",
    "/en/about/leadership", "/en/about/president",
    // Russian university / English-language subsite patterns (SPbPU, ITMO, etc.)
    "/education/programs", "/education/programs/programs-in-english",
    "/education/admissions", "/education/admissions/masters-degree",
    "/education/admissions/doctoral-programs", "/education/admissions/bachelors-degree",
    "/education/admissions/scholarships", "/education/admissions/visa-issues",
    "/education/admissions/admission-offices",
    "/education/students-life/accommodation",
    "/education/students-life", "/education/calendar",
    "/university/rector", "/university/facts-and-figures", "/university/about",
    "/international-activities", "/international-activities/international-students",
  ];
  if (Date.now() - startTime < TIME_BUDGET_MS * 0.3) {
    let probed = 0;
    const probeLimit = 30; // Increased for Russian university paths
    for (const path of commonPaths) {
      if (probed >= probeLimit || Date.now() - startTime > TIME_BUDGET_MS * 0.35) break;
      const probeUrl = normalizedUrl.replace(/\/$/, "") + path;
      if (allLinks.has(probeUrl)) continue;
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 4000);
        const resp = await fetch(probeUrl, {
          method: "HEAD",
          headers: { "User-Agent": pickUA() },
          redirect: "follow",
          signal: ctl.signal,
        });
        clearTimeout(t);
        if (resp.status >= 200 && resp.status < 400) {
          allLinks.add(resp.url || probeUrl);
          probed++;
        }
      } catch { /* path doesn't exist */ }
    }
    passResults.push({ method: "common_paths_probe", probed });
  }

  // Pass 4: Second-level discovery — follow top category pages for deeper links
  if (Date.now() - startTime < TIME_BUDGET_MS * 0.4) {
    const categoryLinks = [...allLinks];
    const feeOrAdmLinks = categoryLinks.filter(u => /fee|tuition|ücret|ucret|harç|harc|admission|basvuru|başvuru|scholar|burs/i.test(u));
    let deepFound = 0;
    for (const deepUrl of feeOrAdmLinks.slice(0, 3)) {
      if (Date.now() - startTime > TIME_BUDGET_MS * 0.45) break;
      try {
        const { html, status } = await fetchHTML(deepUrl);
        if (status >= 200 && status < 400) {
          const deepAnchors = collectAnchors(html, deepUrl).filter(u => isWithinDomain(u, officialDomain));
          deepAnchors.forEach(u => allLinks.add(u));
          deepFound += deepAnchors.length;
        }
      } catch { /* skip */ }
    }
    if (deepFound > 0) passResults.push({ method: "second_level_discovery", found: deepFound });
  }

  // Pass 5: Language/proficiency second-hop discovery
  // Follows admissions/international pages to find deeply nested language requirement pages
  const LANG_HOP_KEYWORDS = /language|english|proficiency|ielts|toefl|pte|duolingo|cefr|entry.?requirement|english.?requirement/i;
  if (Date.now() - startTime < TIME_BUDGET_MS * 0.5) {
    const currentLinks = [...allLinks];
    // Seed pages: admissions, international, entry-requirements — likely to link to language pages
    const seedPages = currentLinks.filter(u =>
      /admission|international|entry|requirement|undergraduate|graduate|postgraduate|english|language|proficiency/i.test(u)
    );
    let langHopFound = 0;
    for (const seedUrl of seedPages.slice(0, 4)) {
      if (Date.now() - startTime > TIME_BUDGET_MS * 0.55) break;
      try {
        const { html, status } = await fetchHTML(seedUrl);
        if (status >= 200 && status < 400) {
          const childLinks = collectAnchors(html, seedUrl).filter(u =>
            isWithinDomain(u, officialDomain) && LANG_HOP_KEYWORDS.test(u)
          );
          childLinks.forEach(u => allLinks.add(u));
          langHopFound += childLinks.length;
        }
      } catch { /* skip */ }
    }
    if (langHopFound > 0) passResults.push({ method: "lang_proficiency_hop", found: langHopFound });
  }

  // Pass 6: Leadership second-hop discovery — follow about/leadership pages for president/rector sub-pages
  const LEADER_HOP_KEYWORDS = /leadership|president|rector|chancellor|vice[\s-]?chancellor|provost|office.of.the/i;
  if (Date.now() - startTime < TIME_BUDGET_MS * 0.55) {
    const currentLinks = [...allLinks];
    const aboutPages = currentLinks.filter(u => /about|leadership|governance/i.test(u));
    let leaderHopFound = 0;
    for (const seedUrl of aboutPages.slice(0, 3)) {
      if (Date.now() - startTime > TIME_BUDGET_MS * 0.6) break;
      try {
        const { html, status } = await fetchHTML(seedUrl);
        if (status >= 200 && status < 400) {
          const childLinks = collectAnchors(html, seedUrl).filter(u =>
            isWithinDomain(u, officialDomain) && LEADER_HOP_KEYWORDS.test(u)
          );
          childLinks.forEach(u => allLinks.add(u));
          leaderHopFound += childLinks.length;
        }
      } catch { /* skip */ }
    }
    if (leaderHopFound > 0) passResults.push({ method: "leadership_hop", found: leaderHopFound });
  }

  // Pass 7: Education hub hop — follow /education/ and /admissions/ hub pages
  // for deeper links to programs, visa, admission-offices, etc.
  const EDU_HOP_KEYWORDS = /program|bachelor|master|doctoral|visa|admission.?office|scholarship|accommodat|living.?cost|how.?to.?apply|english/i;
  if (Date.now() - startTime < TIME_BUDGET_MS * 0.6) {
    const currentLinks = [...allLinks];
    const eduHubPages = currentLinks.filter(u => {
      try {
        const p = new URL(u).pathname.toLowerCase();
        // Only follow hub-level education pages, not deeply nested ones
        return (p.startsWith("/education/") || p.startsWith("/admissions") || p.startsWith("/en/education/"))
          && p.split("/").filter(Boolean).length <= 3;
      } catch { return false; }
    });
    let eduHopFound = 0;
    for (const seedUrl of eduHubPages.slice(0, 4)) {
      if (Date.now() - startTime > TIME_BUDGET_MS * 0.65) break;
      try {
        const { html, status } = await fetchHTML(seedUrl);
        if (status >= 200 && status < 400) {
          const childLinks = collectAnchors(html, seedUrl).filter(u =>
            isWithinDomain(u, officialDomain) && EDU_HOP_KEYWORDS.test(u)
          );
          childLinks.forEach(u => allLinks.add(u));
          eduHopFound += childLinks.length;
        }
      } catch { /* skip */ }
    }
    if (eduHopFound > 0) passResults.push({ method: "education_hub_hop", found: eduHopFound });
  }

  // Always include homepage
  allLinks.add(normalizedUrl);

  // ── Filter out low-value noise URLs before categorization ──
  // Covers /news/, /media/news/, /media/events/, /gallery/, /press/, etc.
  const NOISE_URL_PATTERNS = /\/(?:news\/|novosti\/|новост|press\/|blog\/|gallery\/|galereya\/|photo\/|foto\/|video\/|media\/|events?\/\d|archive\/|job\/|vacancy|vakansi|tender\/|procurement|закупк|magazine\/|journal\/|журнал|gazeta|newspaper|sim-card|mobile|print\/|sitemap\.xml|rss|feed\/|wp-json|wp-admin|wp-content|wp-includes|\.pdf$|\.doc$|\.xls$|\.zip$|\.rar$)/i;
  
  const filteredLinks = [...allLinks].filter(url => {
    if (url === normalizedUrl) return true;
    const lower = url.toLowerCase();
    if (NOISE_URL_PATTERNS.test(lower)) {
      // Only exception: direct educational paths (NOT /media/events/education/)
      const path = (() => { try { return new URL(url).pathname.toLowerCase(); } catch { return lower; } })();
      if (path.startsWith("/education/") || path.startsWith("/admissions") || path.startsWith("/en/education/")) return true;
      return false;
    }
    // Exclude deep /structure/ pages that aren't institutes/faculties
    if (/\/structure\/[^/]+\/?$/.test(lower) && !/institut|facult|school|academ|student_residence/i.test(lower)) return false;
    return true;
  });

  // Categorize all discovered links
  const categorized = filteredLinks.map(url => {
    const lower = url.toLowerCase();
    for (const cat of DISCOVERY_CATEGORIES) {
      if (cat.keywords.test(lower)) {
        return { url, category: cat.category, factGroups: cat.factGroups };
      }
    }
    return { url, category: "general", factGroups: ["identity"] as FactGroup[] };
  });

  // Sort by priority — language elevated to ensure extraction
  const priority = [
    "language", "fees", "admissions", "scholarships", "cta", "international", "housing",
    "programs", "academics", "contact", "about", "student_life", "deadlines",
    "media", "general",
  ];
  categorized.sort((a, b) => {
    const catDiff = priority.indexOf(a.category) - priority.indexOf(b.category);
    if (catDiff !== 0) return catDiff;
    // Within same category: prefer shorter/shallower URLs (closer to educational root)
    const depthA = a.url.split("/").length;
    const depthB = b.url.split("/").length;
    return depthA - depthB;
  });

  // Allow more pages per high-value category to ensure deep coverage
  const categoryCounts: Record<string, number> = {};
  const highValueCats = new Set(["fees", "admissions", "scholarships", "cta", "international", "language"]);
  const medValueCats = new Set(["programs", "housing", "about", "academics", "contact"]);
  const pages = categorized.filter(p => {
    if (p.url === normalizedUrl) return true;
    const count = categoryCounts[p.category] || 0;
    const maxPerCat = highValueCats.has(p.category) ? 3 : medValueCats.has(p.category) ? 2 : 1;
    if (count >= maxPerCat) return false;
    categoryCounts[p.category] = count + 1;
    return true;
  }).slice(0, maxPages);

  return { pages, passResults, homepageHtml };
}

// ─── Extraction: structured by fact group (v3.1 quality improvements) ───
interface ExtractedFact {
  fact_group: FactGroup;
  field_name: string;
  value_raw: string;
  evidence_snippet: string;
  confidence: number;
  program_hint?: string;
}

function extractFacts(markdown: string, html: string, pageUrl: string, factGroups: FactGroup[]): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  const md = markdown || "";
  // Main-content-isolated HTML for extractors that need clean HTML
  const mainHtml = extractMainContentHtml(html);
  // Nav-stripped version for content extraction (description, admissions, housing, costs)
  const cleanMd = htmlToText(mainHtml.length > 200 ? mainHtml : html, { stripNav: true });
  const contentMd = cleanMd.length > 200 ? cleanMd : md;
  // HTML tables from main content only (not sidebar)
  const mainHtmlTables = extractHtmlTableRows(mainHtml.length > 200 ? mainHtml : html);

  // ── Identity ──
  if (factGroups.includes("identity")) {
    const paragraphs = cleanMd.split(/\n{2,}/).filter(p => p.length > 100 && !p.startsWith("#") && !p.startsWith("|"));
    if (paragraphs.length > 0) {
      facts.push({ fact_group: "identity", field_name: "description", value_raw: paragraphs[0].trim().slice(0, 2000), evidence_snippet: paragraphs[0].trim().slice(0, 300), confidence: 0.85 });
    }
    const logoMatch = html.match(/<img[^>]+(?:class|id|alt)="[^"]*logo[^"]*"[^>]+src="([^"]+)"/i) || html.match(/<img[^>]+src="([^"]+logo[^"]+)"/i);
    if (logoMatch) {
      try { const logoUrl = new URL(logoMatch[1], pageUrl).href; facts.push({ fact_group: "identity", field_name: "logo", value_raw: logoUrl, evidence_snippet: `Logo URL: ${logoUrl}`, confidence: 0.9 }); } catch {}
    }
  }

  // ── Contact/Location ──
  if (factGroups.includes("contact_location")) {
    const emailMatch = md.match(/[\w.+-]+@[\w.-]+\.\w{2,}/);
    if (emailMatch) facts.push({ fact_group: "contact_location", field_name: "email", value_raw: emailMatch[0], evidence_snippet: `Email: ${emailMatch[0]}`, confidence: 0.85 });
    const phoneMatch = md.match(/(?:\+7|8)\s*\(?\d{3,4}\)?[\s.-]*\d{2,4}[\s.-]*\d{2,4}(?:[\s.-]*\d{2,4})?/);
    if (phoneMatch) facts.push({ fact_group: "contact_location", field_name: "phone", value_raw: phoneMatch[0].trim(), evidence_snippet: `Phone: ${phoneMatch[0].trim()}`, confidence: 0.8 });
    const addressMatch = md.match(/(?:address|location|campus|adres|adresse)[:\s]*([^\n]{20,150})/i);
    if (addressMatch) facts.push({ fact_group: "contact_location", field_name: "address", value_raw: addressMatch[1].trim(), evidence_snippet: addressMatch[0].slice(0, 200), confidence: 0.7 });
  }

  // ── Admissions (v3.9 — program-scoped fields) ──
  if (factGroups.includes("admissions")) {
    const gpaMatch = md.match(/(?:GPA|grade.?point|CGPA|not ortalaması)[:\s]*(\d+\.?\d*)\s*(?:\/\s*\d+)?/i);
    if (gpaMatch) facts.push({ fact_group: "admissions", field_name: "min_gpa", value_raw: gpaMatch[1], evidence_snippet: gpaMatch[0].slice(0, 200), confidence: 0.75 });
    const reqSection = md.match(/(?:requirement|eligibilit|criteria|koşul|şart|условия)[^]*?(?=\n#{1,3}\s|\n---|\Z)/i);
    if (reqSection) facts.push({ fact_group: "admissions", field_name: "requirements_text", value_raw: reqSection[0].slice(0, 2000), evidence_snippet: reqSection[0].slice(0, 300), confidence: 0.7 });

    // ── Required documents detection (v2 — broader phrasing) ──
    const docPatterns = [
      /(?:required\s+documents?|documents?\s+required|supporting\s+documents?|you(?:'ll)?\s+need\s+to\s+(?:submit|provide|upload))[:\s]*([^]*?)(?=\n#{1,3}\s|\n\n\n|\Z)/i,
      /(?:application\s+(?:checklist|materials?)|what\s+(?:to|you\s+need\s+to)\s+(?:submit|include|send))[:\s]*([^]*?)(?=\n#{1,3}\s|\n\n\n|\Z)/i,
      /(?:you\s+(?:will|must|should)\s+(?:need\s+to\s+)?(?:submit|provide|include|send|upload)\s+(?:the\s+following|these)\s+(?:documents?|materials?))[:\s]*([^]*?)(?=\n#{1,3}\s|\n\n\n|\Z)/i,
    ];
    for (const dp of docPatterns) {
      const docMatch = md.match(dp);
      if (docMatch && docMatch[0].length > 30) {
        facts.push({ fact_group: "admissions", field_name: "required_documents", value_raw: docMatch[0].slice(0, 2000), evidence_snippet: docMatch[0].slice(0, 300), confidence: 0.70 });
        break;
      }
    }

    // ── Interview required (v2 — broader real-world phrasing) ──
    const interviewYes = /(?:interview\s+(?:is\s+)?required|you\s+(?:will|may)\s+(?:be\s+)?(?:invited|required)\s+(?:to\s+)?(?:attend\s+)?(?:an?\s+)?interview|compulsory\s+interview|includes?\s+(?:an?\s+)?interview|invitation\s+to\s+(?:an?\s+)?interview|interview\s+(?:is\s+)?(?:part|a\s+part)\s+of|(?:procedure|process|selection)\s+includes?\s+(?:an?\s+)?interview|invited\s+(?:to|for)\s+(?:an?\s+)?interview)/i;
    const interviewNo = /(?:no\s+interview|interview\s+(?:is\s+)?not\s+required|without\s+(?:an?\s+)?interview)/i;
    const interviewNoMatch = md.match(interviewNo);
    const interviewYesMatch = md.match(interviewYes);
    if (interviewYesMatch && !interviewNoMatch) {
      const idx = interviewYesMatch.index || 0;
      facts.push({ fact_group: "admissions", field_name: "interview_required", value_raw: "true", evidence_snippet: md.substring(Math.max(0, idx - 40), Math.min(md.length, idx + interviewYesMatch[0].length + 80)).slice(0, 300), confidence: 0.80 });
    } else if (interviewNoMatch) {
      const idx = interviewNoMatch.index || 0;
      facts.push({ fact_group: "admissions", field_name: "interview_required", value_raw: "false", evidence_snippet: md.substring(Math.max(0, idx - 40), Math.min(md.length, idx + interviewNoMatch[0].length + 80)).slice(0, 300), confidence: 0.75 });
    }

    // ── Portfolio required ──
    const portfolioYes = /(?:portfolio\s+(?:is\s+)?required|submit\s+(?:a\s+)?portfolio|portfolio\s+submission|you\s+(?:will|must)\s+(?:need\s+to\s+)?(?:submit|provide)\s+(?:a\s+)?portfolio)/i;
    const portfolioMatch = md.match(portfolioYes);
    if (portfolioMatch) {
      const idx = portfolioMatch.index || 0;
      facts.push({ fact_group: "admissions", field_name: "portfolio_required", value_raw: "true", evidence_snippet: md.substring(Math.max(0, idx - 40), Math.min(md.length, idx + portfolioMatch[0].length + 80)).slice(0, 300), confidence: 0.80 });
    }

    // ── Entrance exam required (v2 — catches UCAT/BMAT/aptitude test) ──
    const examYes = /(?:entrance\s+exam(?:ination)?\s+(?:is\s+)?required|must\s+(?:pass|take|sit)\s+(?:an?\s+)?(?:entrance\s+)?(?:exam|test)|aptitude\s+test\s+(?:is\s+)?required|subject\s+(?:to|requires?)\s+(?:an?\s+)?(?:entrance\s+)?(?:exam|test)|must\s+sit\s+the\s+(?:UCAT|BMAT|UKCAT|GAMSAT|MCAT)\s+(?:test|exam)?|(?:UCAT|BMAT|UKCAT|GAMSAT|MCAT)\s+(?:is\s+)?required|applicants?\s+must\s+(?:complete|sit|take)\s+(?:the\s+)?(?:UCAT|BMAT|UKCAT|GAMSAT|MCAT))/i;
    const examMatch = md.match(examYes);
    if (examMatch) {
      const idx = examMatch.index || 0;
      facts.push({ fact_group: "admissions", field_name: "entrance_exam_required", value_raw: "true", evidence_snippet: md.substring(Math.max(0, idx - 40), Math.min(md.length, idx + examMatch[0].length + 80)).slice(0, 300), confidence: 0.75 });
    }

    // ── Admission notes (short program-specific text near "how to apply" / "entry" sections) ──
    const admNotesPatterns = [
      /(?:how\s+to\s+apply|application\s+process|apply\s+for\s+this)[:\s]*([^]*?)(?=\n#{1,3}\s|\n\n\n|\Z)/i,
      /(?:entry\s+requirements?|what\s+(?:we(?:'re)?|you(?:'ll)?)\s+(?:look|need))[:\s]*([^]*?)(?=\n#{1,3}\s|\n\n\n|\Z)/i,
    ];
    for (const anp of admNotesPatterns) {
      const notesMatch = cleanMd.match(anp);
      if (notesMatch && notesMatch[0].length > 50) {
        facts.push({ fact_group: "admissions", field_name: "admission_notes_text", value_raw: notesMatch[0].slice(0, 3000), evidence_snippet: notesMatch[0].slice(0, 300), confidence: 0.65 });
        break;
      }
    }
    // ══ EU ADMISSIONS SCOPE EXPANSION (v5.0) ══

    // ── Application route / platform detection ──
    const ROUTE_PATTERNS: Array<{ type: string; pattern: RegExp }> = [
      { type: "uni_assist", pattern: /uni[\s-]?assist|VPD|vorprüfungsdokumentation/i },
      { type: "universitaly", pattern: /universitaly|universital[iy]/i },
      { type: "national_portal", pattern: /(?:national|centrali[sz]ed|state)\s+(?:admission|application)\s+(?:portal|platform|system)|UCAS|Studielink|Parcoursup|Campus\s*France|ENIC[\s-]NARIC|StudyIn(?:Holland|Italy|Germany)/i },
      { type: "centralized_platform", pattern: /(?:online\s+)?application\s+(?:portal|platform|system)|apply\s+(?:via|through)\s+(?:our|the)\s+(?:portal|platform|system)/i },
    ];
    for (const { type, pattern } of ROUTE_PATTERNS) {
      const routeMatch = md.match(pattern);
      if (routeMatch) {
        const idx = routeMatch.index || 0;
        const ctx = md.substring(Math.max(0, idx - 80), Math.min(md.length, idx + routeMatch[0].length + 200));
        facts.push({ fact_group: "admissions", field_name: "admission_route_type", value_raw: type, evidence_snippet: ctx.slice(0, 300), confidence: 0.80 });
        // Extract platform URL if nearby
        const urlInCtx = ctx.match(/https?:\/\/[^\s"'<>]+/);
        if (urlInCtx) {
          facts.push({ fact_group: "admissions", field_name: "admission_platform_url", value_raw: urlInCtx[0], evidence_snippet: ctx.slice(0, 300), confidence: 0.75 });
        }
        // Extract platform name
        const nameMatch = ctx.match(/(?:via|through|on)\s+(?:the\s+)?([A-Z][A-Za-z\s-]{2,30})\s+(?:portal|platform|system|website)/i);
        if (nameMatch) {
          facts.push({ fact_group: "admissions", field_name: "admission_platform_name", value_raw: nameMatch[1].trim(), evidence_snippet: ctx.slice(0, 300), confidence: 0.70 });
        }
        break;
      }
    }

    // ── Structured eligibility rules ──
    const ELIGIBILITY_PATTERNS: Array<{ field: string; pattern: RegExp }> = [
      { field: "eligibility_prior_degree", pattern: /(?:(?:hold|possess|have)\s+(?:a\s+)?(?:bachelor|master|undergraduate|first)\s+degree|(?:bachelor|undergraduate|first)\s+degree\s+(?:is\s+)?required|previous\s+(?:degree|qualification))[^.]*\./i },
      { field: "eligibility_subject_match", pattern: /(?:(?:relevant|related)\s+(?:degree|background|field|subject)|(?:degree|background)\s+in\s+(?:a\s+)?related|academic\s+(?:coherence|consistency)|same\s+(?:field|discipline|subject))[^.]*\./i },
      { field: "eligibility_equivalency", pattern: /(?:equival(?:ent|ence)|recogni(?:tion|[sz]ed)|credential\s+evaluation|ENIC[\s-]NARIC|nostrification|homologation|legalisation|apostille)[^.]*\./i },
      { field: "eligibility_degree_length", pattern: /(?:(?:minimum|at\s+least)\s+\d+\s+(?:years?|semesters?|credits?)\s+(?:of\s+)?(?:study|education|higher\s+education)|\d+[\s-]year\s+(?:bachelor|undergraduate|degree))[^.]*\./i },
    ];
    for (const { field, pattern } of ELIGIBILITY_PATTERNS) {
      const eligMatch = md.match(pattern);
      if (eligMatch) {
        const idx = eligMatch.index || 0;
        facts.push({ fact_group: "admissions", field_name: field, value_raw: eligMatch[0].trim().slice(0, 1000), evidence_snippet: md.substring(Math.max(0, idx - 40), Math.min(md.length, idx + eligMatch[0].length + 80)).slice(0, 300), confidence: 0.70 });
      }
    }

    // ── Structured required documents detection ──
    const DOC_TYPES: Array<{ field: string; pattern: RegExp }> = [
      { field: "required_doc_transcript", pattern: /(?:official\s+)?transcript/i },
      { field: "required_doc_diploma", pattern: /(?:degree\s+)?(?:diploma|certificate)/i },
      { field: "required_doc_cv", pattern: /(?:curriculum\s+vitae|CV|résumé|resume)/i },
      { field: "required_doc_motivation_letter", pattern: /(?:motivation|personal)\s+(?:letter|statement)|letter\s+of\s+motivation|statement\s+of\s+purpose/i },
      { field: "required_doc_recommendation_letter", pattern: /(?:recommendation|reference)\s+letter|letter\s+of\s+(?:recommendation|reference)/i },
      { field: "required_doc_passport_copy", pattern: /(?:passport|ID)\s+(?:copy|scan|photo)/i },
      { field: "required_doc_language_certificate", pattern: /(?:language|english)\s+(?:certificate|proficiency\s+(?:proof|certificate))|(?:IELTS|TOEFL)\s+(?:certificate|score\s+report)/i },
      { field: "required_doc_portfolio", pattern: /portfolio/i },
      { field: "required_doc_grading_scale", pattern: /grading\s+(?:scale|system|key)/i },
    ];
    // Only detect within document requirement sections
    const docSectionMatch = md.match(/(?:required\s+documents?|documents?\s+required|supporting\s+documents?|application\s+(?:checklist|materials?))[:\s]*([^]*?)(?=\n#{1,3}\s|\n\n\n|\Z)/i);
    if (docSectionMatch) {
      const docBlock = docSectionMatch[0];
      for (const { field, pattern } of DOC_TYPES) {
        if (pattern.test(docBlock)) {
          facts.push({ fact_group: "admissions", field_name: field, value_raw: "true", evidence_snippet: docBlock.slice(0, 300), confidence: 0.75 });
        }
      }
      // Translation/certified copy requirements
      if (/translat(?:ion|ed)|sworn\s+translat/i.test(docBlock)) {
        facts.push({ fact_group: "admissions", field_name: "required_doc_translation", value_raw: "true", evidence_snippet: docBlock.slice(0, 300), confidence: 0.70 });
      }
      if (/certif(?:ied|icate)\s+cop(?:y|ies)|notari[sz]ed|apostille/i.test(docBlock)) {
        facts.push({ fact_group: "admissions", field_name: "required_doc_certified_copy", value_raw: "true", evidence_snippet: docBlock.slice(0, 300), confidence: 0.70 });
      }
    }

    // ── Multiple deadline types ──
    const DEADLINE_TYPES: Array<{ field: string; pattern: RegExp }> = [
      { field: "supporting_documents_deadline", pattern: /(?:supporting\s+)?documents?\s+(?:deadline|due|must\s+be\s+(?:submitted|received)\s+by)[:\s]*([^\n]{5,100})/i },
      { field: "fee_deadline", pattern: /(?:(?:application|tuition)\s+)?fee\s+(?:deadline|due|payment\s+(?:deadline|due))[:\s]*([^\n]{5,100})/i },
      { field: "results_date", pattern: /(?:results?\s+(?:date|announced?|published|released)|decision\s+(?:date|by|expected))[:\s]*([^\n]{5,100})/i },
      { field: "acceptance_reply_deadline", pattern: /(?:accept(?:ance)?\s+(?:deadline|reply|response)|confirm\s+(?:your\s+)?(?:place|offer)\s+by|reply\s+(?:deadline|by))[:\s]*([^\n]{5,100})/i },
      { field: "enrollment_deadline", pattern: /(?:enrol(?:l?ment|l)\s+(?:deadline|by)|registration\s+(?:deadline|closes?|by)|final\s+registration)[:\s]*([^\n]{5,100})/i },
    ];
    for (const { field, pattern } of DEADLINE_TYPES) {
      const dlMatch = md.match(pattern);
      if (dlMatch) {
        const idx = dlMatch.index || 0;
        facts.push({ fact_group: "deadlines_intakes", field_name: field, value_raw: (dlMatch[1] || dlMatch[0]).trim().slice(0, 200), evidence_snippet: md.substring(Math.max(0, idx - 40), Math.min(md.length, idx + dlMatch[0].length + 80)).slice(0, 300), confidence: 0.70 });
      }
    }

    // ── Application fee + exemption ──
    const appFeeMatch = md.match(/(?:application\s+fee|apply(?:ing)?\s+fee|processing\s+fee)[:\s]*(?:€|£|\$|₺)?\s*([\d.,]+)\s*(EUR|USD|GBP|TRY|€|£|\$|₺)?/i);
    if (appFeeMatch) {
      const idx = appFeeMatch.index || 0;
      const ctx = md.substring(Math.max(0, idx - 40), Math.min(md.length, idx + appFeeMatch[0].length + 120)).slice(0, 300);
      facts.push({ fact_group: "admissions", field_name: "application_fee_amount", value_raw: appFeeMatch[1].replace(/[.,](?=\d{3})/g, ""), evidence_snippet: ctx, confidence: 0.75 });
      const curr = appFeeMatch[2] || (appFeeMatch[0].includes("€") ? "EUR" : appFeeMatch[0].includes("£") ? "GBP" : appFeeMatch[0].includes("₺") ? "TRY" : "USD");
      facts.push({ fact_group: "admissions", field_name: "application_fee_currency", value_raw: curr.replace("€","EUR").replace("£","GBP").replace("$","USD").replace("₺","TRY"), evidence_snippet: ctx, confidence: 0.70 });
    }
    const feeExemptMatch = md.match(/(?:fee\s+(?:waiver|exemption|free)|no\s+application\s+fee|application\s+(?:is\s+)?free|exempt\s+from\s+(?:the\s+)?(?:application\s+)?fee|EU[\s/]EEA\s+(?:students?\s+)?(?:are\s+)?exempt)[^.]*\./i);
    if (feeExemptMatch) {
      const idx = feeExemptMatch.index || 0;
      facts.push({ fact_group: "admissions", field_name: "fee_exemption_rule", value_raw: feeExemptMatch[0].trim().slice(0, 500), evidence_snippet: md.substring(Math.max(0, idx - 40), Math.min(md.length, idx + feeExemptMatch[0].length + 80)).slice(0, 300), confidence: 0.70 });
    }

    // ── Selection process (aptitude, multi-stage, ranking) ──
    const aptitudeMatch = md.match(/(?:aptitude\s+(?:test|assessment|exam)|skill\s+(?:test|assessment)|competence\s+(?:test|assessment))/i);
    if (aptitudeMatch) {
      const idx = aptitudeMatch.index || 0;
      facts.push({ fact_group: "admissions", field_name: "aptitude_assessment_required", value_raw: "true", evidence_snippet: md.substring(Math.max(0, idx - 40), Math.min(md.length, idx + aptitudeMatch[0].length + 80)).slice(0, 300), confidence: 0.75 });
    }
    const multiStageMatch = md.match(/(?:(?:multi|two|three)[\s-]?stage|multiple\s+rounds?|first\s+(?:round|stage)|second\s+(?:round|stage)|selection\s+(?:rounds?|stages?|phases?))/i);
    if (multiStageMatch) {
      const idx = multiStageMatch.index || 0;
      facts.push({ fact_group: "admissions", field_name: "multi_stage_selection", value_raw: "true", evidence_snippet: md.substring(Math.max(0, idx - 40), Math.min(md.length, idx + multiStageMatch[0].length + 80)).slice(0, 300), confidence: 0.65 });
    }
    const rankingMatch = md.match(/(?:ranking[\s-]based|competitive\s+selection|merit[\s-]based|ranked\s+(?:by|according)|selection\s+(?:is\s+)?(?:based\s+on|competitive))/i);
    if (rankingMatch) {
      const idx = rankingMatch.index || 0;
      facts.push({ fact_group: "admissions", field_name: "ranking_selection", value_raw: "true", evidence_snippet: md.substring(Math.max(0, idx - 40), Math.min(md.length, idx + rankingMatch[0].length + 80)).slice(0, 300), confidence: 0.65 });
    }

    // ── Pre-enrolment / visa route ──
    const preEnrolMatch = md.match(/(?:pre[\s-]?enrol(?:l?ment|l)|pre[\s-]?inscription|pre[\s-]?immatriculation|pre[\s-]?iscrizione)/i);
    if (preEnrolMatch) {
      const idx = preEnrolMatch.index || 0;
      const ctx = md.substring(Math.max(0, idx - 80), Math.min(md.length, idx + preEnrolMatch[0].length + 300));
      facts.push({ fact_group: "admissions", field_name: "pre_enrolment_required", value_raw: "true", evidence_snippet: ctx.slice(0, 300), confidence: 0.75 });
      const platUrl = ctx.match(/https?:\/\/[^\s"'<>]+/);
      if (platUrl) facts.push({ fact_group: "admissions", field_name: "pre_enrolment_url", value_raw: platUrl[0], evidence_snippet: ctx.slice(0, 300), confidence: 0.70 });
      const platName = ctx.match(/(?:via|through|on)\s+(?:the\s+)?([A-Z][A-Za-z\s-]{2,30})\s+(?:portal|platform|system)/i);
      if (platName) facts.push({ fact_group: "admissions", field_name: "pre_enrolment_platform", value_raw: platName[1].trim(), evidence_snippet: ctx.slice(0, 300), confidence: 0.65 });
    }

    // ── Preparatory / foundation / bridging route ──
    const prepMatch = md.match(/(?:preparatory\s+(?:year|course|program)|foundation\s+(?:year|course|program)|bridging\s+(?:course|program)|Studienkolleg|année\s+préparatoire|hazırlık\s+(?:yılı|sınıfı)|подготовительн)/i);
    if (prepMatch) {
      const idx = prepMatch.index || 0;
      const ctx = md.substring(Math.max(0, idx - 80), Math.min(md.length, idx + prepMatch[0].length + 300));
      facts.push({ fact_group: "admissions", field_name: "preparatory_route_required", value_raw: "true", evidence_snippet: ctx.slice(0, 300), confidence: 0.70 });
      facts.push({ fact_group: "admissions", field_name: "preparatory_route_name", value_raw: prepMatch[0].trim(), evidence_snippet: ctx.slice(0, 300), confidence: 0.65 });
    }

    // ── Country-specific conditions ──
    const countryCondPatterns = [
      /(?:applicants?\s+from|students?\s+from|citizens?\s+of|nationals?\s+of)\s+([A-Z][a-zA-Z\s,]+?)\s+(?:must|are\s+required|need\s+to|should)[^.]*\./i,
      /(?:for\s+)?(?:EU|EEA|non[\s-]EU|international|third[\s-]country)\s+(?:students?|applicants?|nationals?)[,:\s]+[^.]*\./i,
    ];
    for (const ccp of countryCondPatterns) {
      const ccMatch = md.match(ccp);
      if (ccMatch) {
        const idx = ccMatch.index || 0;
        facts.push({ fact_group: "admissions", field_name: "country_condition", value_raw: ccMatch[0].trim().slice(0, 1000), evidence_snippet: md.substring(Math.max(0, idx - 40), Math.min(md.length, idx + ccMatch[0].length + 80)).slice(0, 300), confidence: 0.65 });
        break;
      }
    }
  }

  // ── Deadlines/Intakes (v4.4 — HTML table + markdown extraction) ──
  if (factGroups.includes("deadlines_intakes")) {
    // Try HTML tables first for deadline dates
    let structuredDeadlines = extractDeadlineFactsFromHtmlTables(mainHtmlTables, facts);
    // Then try markdown-based extraction
    structuredDeadlines += extractDeadlineFactsFromMarkdown(contentMd, facts);

    // Fallback only if structured extraction found nothing
    if (structuredDeadlines === 0) {
      const deadlinePatterns = [
        /(?:application\s+)?deadline[:\s]*(\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4})/i,
        /(?:apply\s+by|applications?\s+(?:close|due|must\s+be\s+(?:received|submitted)\s+by))[:\s]*(\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4})/i,
        /(?:application\s+)?deadline[:\s]*(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/i,
      ];

      for (const dp of deadlinePatterns) {
        const dm = contentMd.match(dp);
        if (dm) {
          const idx = dm.index || 0;
          facts.push({
            fact_group: "deadlines_intakes",
            field_name: "application_deadline",
            value_raw: dm[1].trim(),
            evidence_snippet: contentMd.substring(Math.max(0, idx - 40), Math.min(contentMd.length, idx + dm[0].length + 80)).slice(0, 300),
            confidence: 0.75,
          });
          break;
        }
      }
    }

    // ── Intake months / periods (v2 — quality-focused) ──
    const MONTH_RE_G = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi;
    const SEMESTER_NAMES = /\b(fall|spring|autumn|winter|summer)\b/gi;

    const startDatePatterns = [
      /(?:start\s+date|starts?\s+on|starts?\s+in|commenc(?:es?|ing)|course\s+start|programme?\s+start|program\s+start)[:\s]*([^\n]{3,120})/gi,
      /(?:intake\s+(?:date|period|month)s?)[:\s]*([^\n]{3,120})/gi,
      /(?:entry\s+(?:date|point)s?)[:\s]*([^\n]{3,120})/gi,
    ];

    let intakeMonthsExtracted: string[] = [];
    let intakeLabelExtracted = "";
    let intakeSnippet = "";
    let intakeConfidence = 0;

    for (const pat of startDatePatterns) {
      const matches = [...contentMd.matchAll(pat)];
      for (const m of matches) {
        const captured = m[1] || m[0];
        const months = [...captured.matchAll(MONTH_RE_G)].map(x => x[0].toLowerCase());
        if (months.length > 0) {
          intakeMonthsExtracted = [...new Set(months)];
          const yearMatch = captured.match(/\b(20\d{2})\b/);
          intakeLabelExtracted = months.map(v => v.charAt(0).toUpperCase() + v.slice(1)).join(", ") + (yearMatch ? ` ${yearMatch[1]}` : "");
          const idx = m.index || 0;
          intakeSnippet = contentMd.substring(Math.max(0, idx - 30), Math.min(contentMd.length, idx + m[0].length + 80)).slice(0, 300);
          intakeConfidence = 0.80;
          break;
        }

        const semesters = [...captured.matchAll(SEMESTER_NAMES)].map(x => x[0].toLowerCase());
        if (semesters.length > 0 && !intakeLabelExtracted) {
          const yearMatch = captured.match(/\b(20\d{2})\b/);
          intakeLabelExtracted = semesters.map(v => v.charAt(0).toUpperCase() + v.slice(1)).join(", ") + (yearMatch ? ` ${yearMatch[1]}` : "");
          const idx = m.index || 0;
          intakeSnippet = contentMd.substring(Math.max(0, idx - 30), Math.min(contentMd.length, idx + m[0].length + 80)).slice(0, 300);
          intakeConfidence = 0.70;
        }
      }
      if (intakeMonthsExtracted.length > 0) break;
    }

    if (intakeMonthsExtracted.length === 0) {
      const blockMatch = contentMd.match(/start\s+date[^\n]*\n\s*\n?\s*([^\n]{3,80})/i);
      if (blockMatch) {
        const line = blockMatch[1];
        const months = [...line.matchAll(MONTH_RE_G)].map(x => x[0].toLowerCase());
        if (months.length > 0) {
          intakeMonthsExtracted = [...new Set(months)];
          const yearMatch = line.match(/\b(20\d{2})\b/);
          intakeLabelExtracted = months.map(v => v.charAt(0).toUpperCase() + v.slice(1)).join(", ") + (yearMatch ? ` ${yearMatch[1]}` : "");
          intakeSnippet = blockMatch[0].slice(0, 300);
          intakeConfidence = 0.75;
        }
      }
    }

    if (intakeMonthsExtracted.length > 0) {
      facts.push({ fact_group: "deadlines_intakes", field_name: "intake_months", value_raw: intakeMonthsExtracted.join(","), evidence_snippet: intakeSnippet, confidence: intakeConfidence });
    }
    if (intakeLabelExtracted) {
      facts.push({ fact_group: "deadlines_intakes", field_name: "intake_label", value_raw: intakeLabelExtracted, evidence_snippet: intakeSnippet, confidence: intakeConfidence });
    }
  }

  // ══ TUITION/FEES — v4.4 HTML-table-first extraction ══
  if (factGroups.includes("tuition_fees")) {
    extractTuitionFees(contentMd, mainHtml.length > 200 ? mainHtml : html, pageUrl, facts, mainHtmlTables);
  }

  // ── Scholarships ──
  if (factGroups.includes("scholarships")) {
    const schlPattern = /(?:scholarship|burs|grant|fellowship|стипенди|financial.?aid|mali.?destek)[^]*?(?:\n\n|\n#{1,3}|\Z)/i;
    const schlMatch = md.match(schlPattern);
    if (schlMatch) facts.push({ fact_group: "scholarships", field_name: "scholarship_info", value_raw: schlMatch[0].slice(0, 2000), evidence_snippet: schlMatch[0].slice(0, 300), confidence: 0.65 });
    // Look for percentage discounts
    const discountMatch = md.match(/(\d{1,3})\s*%\s*(?:scholarship|burs|discount|indirim|скидк)/i);
    if (discountMatch) facts.push({ fact_group: "scholarships", field_name: "scholarship_percentage", value_raw: discountMatch[1] + "%", evidence_snippet: discountMatch[0].slice(0, 200), confidence: 0.7 });
  }

  // ── Language Requirements (v3.8 — row-bounded + table-aware extraction) ──
  if (factGroups.includes("language_requirements")) {
    // ── Row-bounded table extraction (works on raw HTML for accuracy) ──
    // Parses HTML <tr> rows to isolate each qualification's details, preventing cross-row bleeding
    function extractFromHtmlTable(): Record<string, { value: string; snippet: string }> {
      const results: Record<string, { value: string; snippet: string }> = {};
      // Find all table rows in the HTML
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      for (const rowMatch of html.matchAll(rowRegex)) {
        const rowHtml = rowMatch[1];
        // Extract cells
        const cells = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c => c[1].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
        if (cells.length < 2) continue;
        
        const qual = cells[0].toLowerCase();
        const details = cells.slice(1).join(" ");

        // IELTS
        if (/ielts/i.test(qual) && !results["min_ielts"]) {
          const m = details.match(/(\d+\.?\d*)\s+(?:overall|with\s+no)/i);
          if (m) {
            const v = parseFloat(m[1]);
            if (v >= 4.0 && v <= 9.0) results["min_ielts"] = { value: m[1], snippet: `${cells[0]}: ${details}`.slice(0, 300) };
          }
        }
        // TOEFL
        if (/toefl/i.test(qual) && !results["min_toefl"]) {
          const beforeMatch = details.match(/(?:before[^,]*?|you['']?ll\s+need)\s+(\d{2,3})\s+overall/i);
          if (beforeMatch) {
            const v = parseInt(beforeMatch[1], 10);
            if (v >= 40 && v <= 120) results["min_toefl"] = { value: beforeMatch[1], snippet: `${cells[0]}: ${details}`.slice(0, 300) };
          } else {
            const simpleMatch = details.match(/(\d{2,3})\s+(?:overall|with|minimum)/i);
            if (simpleMatch) {
              const v = parseInt(simpleMatch[1], 10);
              if (v >= 40 && v <= 120) results["min_toefl"] = { value: simpleMatch[1], snippet: `${cells[0]}: ${details}`.slice(0, 300) };
            }
          }
        }
        // Duolingo
        if (/duolingo/i.test(qual) && !results["duolingo_min"]) {
          const m = details.match(/(\d{2,3})\s+(?:overall|with|minimum)/i);
          if (m) {
            const v = parseInt(m[1], 10);
            if (v >= 50 && v <= 160) results["duolingo_min"] = { value: String(v), snippet: `${cells[0]}: ${details}`.slice(0, 300) };
          }
        }
        // PTE
        if (/(?:pte|pearson)/i.test(qual) && !results["pte_min"]) {
          const m = details.match(/(\d{2,3})\s+(?:overall|with|minimum)/i);
          if (m) {
            const v = parseInt(m[1], 10);
            if (v >= 30 && v <= 90) results["pte_min"] = { value: String(v), snippet: `${cells[0]}: ${details}`.slice(0, 300) };
          }
        }
      }
      return results;
    }

    // Try HTML row-bounded extraction first (prevents cross-row value bleeding)
    const tableResults = extractFromHtmlTable();
    const usedTable = Object.keys(tableResults).length > 0;

    if (tableResults["min_ielts"]) {
      facts.push({ fact_group: "language_requirements", field_name: "min_ielts", value_raw: tableResults["min_ielts"].value, evidence_snippet: tableResults["min_ielts"].snippet, confidence: 0.92 });
    }
    if (tableResults["min_toefl"]) {
      facts.push({ fact_group: "language_requirements", field_name: "min_toefl", value_raw: tableResults["min_toefl"].value, evidence_snippet: tableResults["min_toefl"].snippet, confidence: 0.92 });
    }
    if (tableResults["duolingo_min"]) {
      facts.push({ fact_group: "language_requirements", field_name: "duolingo_min", value_raw: tableResults["duolingo_min"].value, evidence_snippet: tableResults["duolingo_min"].snippet, confidence: 0.92 });
    }
    if (tableResults["pte_min"]) {
      facts.push({ fact_group: "language_requirements", field_name: "pte_min", value_raw: tableResults["pte_min"].value, evidence_snippet: tableResults["pte_min"].snippet, confidence: 0.92 });
    }

    // ── Fallback: "Good" tier table extraction (multi-tier tables) ──
    function extractTableScore(testHeadingRegex: RegExp, scoreRegex: RegExp): { value: string; snippet: string } | null {
      const headingMatch = md.match(testHeadingRegex);
      if (!headingMatch || headingMatch.index === undefined) return null;
      const after = md.substring(headingMatch.index, headingMatch.index + 800);
      const goodRow = after.match(/\|\s*Good\s*\|[\s\n]*\|?\s*([^|]+)\|/i);
      if (!goodRow) {
        const goodNear = after.match(/Good[:\s]+(\d+\.?\d*)\s+(?:with|overall|minimum)/i);
        if (!goodNear) return null;
        return { value: goodNear[1], snippet: after.substring(0, 300) };
      }
      const cellText = goodRow[1].trim();
      const scoreMatch = cellText.match(scoreRegex);
      if (!scoreMatch) return null;
      return { value: scoreMatch[1], snippet: after.substring(0, 300) };
    }

    // Only use tier-table / inline fallbacks for fields NOT already found by row-bounded extraction
    if (!tableResults["min_ielts"]) {
      const ieltsTable = extractTableScore(/\*{0,2}IELTS\s+(?:Academic|for\s+UKVI)\*{0,2}/i, /(\d+\.?\d*)\s+(?:with|overall|minimum)/i);
      if (ieltsTable) {
        const val = parseFloat(ieltsTable.value);
        if (val >= 4.0 && val <= 9.0) facts.push({ fact_group: "language_requirements", field_name: "min_ielts", value_raw: ieltsTable.value, evidence_snippet: ieltsTable.snippet, confidence: 0.90 });
      } else {
        const ieltsInline = md.match(/IELTS\s+(?:Academic\s+)?(?:overall\s+)?(?:band\s+)?(\d+\.?\d*)(?:\s+(?:or\s+(?:above|higher)|overall|with))/i);
        if (ieltsInline) { const val = parseFloat(ieltsInline[1]); if (val >= 4.0 && val <= 9.0) facts.push({ fact_group: "language_requirements", field_name: "min_ielts", value_raw: ieltsInline[1], evidence_snippet: ieltsInline[0].slice(0, 200), confidence: 0.80 }); }
      }
    }

    if (!tableResults["min_toefl"]) {
      const toeflTable = extractTableScore(/\*{0,2}TOEFL\s+iBT\*{0,2}[\s*]*\(?\s*tests?\s+taken\s+before/i, /(\d{2,3})\s+(?:overall|with|minimum)/i)
        || extractTableScore(/\*{0,2}TOEFL\s+iBT\*{0,2}[\s*]*\(?\s*tests?\s+taken/i, /(\d{2,3})\s+(?:overall|with|minimum)/i);
      if (toeflTable) {
        const val = parseInt(toeflTable.value, 10);
        if (val >= 40 && val <= 120) facts.push({ fact_group: "language_requirements", field_name: "min_toefl", value_raw: toeflTable.value, evidence_snippet: toeflTable.snippet, confidence: 0.90 });
      } else {
        // Row-bounded inline: find TOEFL mention and extract ONLY from the same paragraph/line
        const toeflParagraphs = md.split(/\n{2,}/).filter(p => /toefl/i.test(p));
        for (const para of toeflParagraphs) {
          const m = para.match(/(\d{2,3})\s+(?:overall|with\s+minimum|minimum)/i);
          if (m) { const val = parseInt(m[1], 10); if (val >= 40 && val <= 120) { facts.push({ fact_group: "language_requirements", field_name: "min_toefl", value_raw: m[1], evidence_snippet: para.slice(0, 300), confidence: 0.75 }); break; } }
        }
      }
    }

    if (!tableResults["duolingo_min"]) {
      const duoTable = extractTableScore(/\*{0,2}Duolingo\s+English\s+Test\*{0,2}/i, /(\d{2,3})\s+(?:overall|with|minimum)/i);
      if (duoTable) {
        const val = parseInt(duoTable.value, 10);
        if (val >= 50 && val <= 160) facts.push({ fact_group: "language_requirements", field_name: "duolingo_min", value_raw: String(val), evidence_snippet: duoTable.snippet, confidence: 0.90 });
      } else {
        // Row-bounded inline
        const duoParagraphs = md.split(/\n{2,}/).filter(p => /duolingo/i.test(p));
        for (const para of duoParagraphs) {
          const m = para.match(/(\d{2,3})\s+(?:overall|with|minimum)/i);
          if (m) { const val = parseInt(m[1], 10); if (val >= 50 && val <= 160) { facts.push({ fact_group: "language_requirements", field_name: "duolingo_min", value_raw: String(val), evidence_snippet: para.slice(0, 300), confidence: 0.75 }); break; } }
        }
      }
    }

    if (!tableResults["pte_min"]) {
      const pteTable = extractTableScore(/\*{0,2}(?:Pearson\s+(?:PTE\s+Academic|Academic\s+UKVI)|PTE\s+Academic)\*{0,2}/i, /(\d{2,3})\s+(?:with|overall|minimum)/i);
      if (pteTable) {
        const val = parseInt(pteTable.value, 10);
        if (val >= 30 && val <= 90) facts.push({ fact_group: "language_requirements", field_name: "pte_min", value_raw: String(val), evidence_snippet: pteTable.snippet, confidence: 0.90 });
      } else {
        const pteInline = md.match(/(?:PTE|Pearson)\s+(?:Academic|Test\s+of\s+English)[^]*?(\d{2,3})(?:\s+(?:overall|with|minimum))/i);
        if (pteInline) { const val = parseInt(pteInline[1], 10); if (val >= 30 && val <= 90) facts.push({ fact_group: "language_requirements", field_name: "pte_min", value_raw: String(val), evidence_snippet: pteInline[0].slice(0, 300), confidence: 0.80 }); }
      }
    }

    // PTE — table-aware, handles "Pearson PTE Academic" and "Pearson Academic UKVI"
    const pteTable = extractTableScore(
      /\*{0,2}(?:Pearson\s+(?:PTE\s+Academic|Academic\s+UKVI)|PTE\s+Academic)\*{0,2}/i,
      /(\d{2,3})\s+(?:with|overall|minimum)/i
    );
    if (pteTable) {
      const val = parseInt(pteTable.value, 10);
      if (val >= 30 && val <= 90) {
        facts.push({ fact_group: "language_requirements", field_name: "pte_min", value_raw: String(val), evidence_snippet: pteTable.snippet, confidence: 0.90 });
      }
    } else {
      // Inline fallback
      const pteInline = md.match(/(?:PTE|Pearson)\s+(?:Academic|Test\s+of\s+English)[^]*?(\d{2,3})(?:\s+(?:overall|with|minimum))/i);
      if (pteInline) {
        const val = parseInt(pteInline[1], 10);
        if (val >= 30 && val <= 90) {
          facts.push({ fact_group: "language_requirements", field_name: "pte_min", value_raw: String(val), evidence_snippet: pteInline[0].slice(0, 300), confidence: 0.80 });
        }
      }
    }

    // CEFR level (A1-C2) — kept from v3.4, proven working
    const cefrPatterns = [
      /CEFR[^|\n]*?(?:[|:\s]+)\s*(?:level\s+)?([ABC][12])/i,
      /CEFR[:\s]+(?:level\s+)?([ABC][12])/i,
      /(?:language\s+level|proficiency\s+level|english\s+level|minimum\s+level)[^|\n]*?(?:[|:\s]+)\s*([ABC][12])/i,
      /(?:at\s+least|minimum)\s+([ABC][12])\s+(?:level|CEFR)/i,
      /([BC][12])\s+(?:level\s+)?(?:according\s+to\s+)?(?:the\s+)?CEFR/i,
    ];
    for (const cp of cefrPatterns) {
      const cefrMatch = md.match(cp);
      if (cefrMatch) {
        const level = cefrMatch[1].toUpperCase();
        const ctxStart = Math.max(0, (cefrMatch.index || 0) - 80);
        const ctxEnd = Math.min(md.length, (cefrMatch.index || 0) + cefrMatch[0].length + 80);
        facts.push({ fact_group: "language_requirements", field_name: "cefr_level", value_raw: level, evidence_snippet: md.substring(ctxStart, ctxEnd).slice(0, 300), confidence: 0.80 });
        break;
      }
    }

    // Language of instruction / MOI
    const KNOWN_LANGUAGES = /^(?:english|arabic|french|german|spanish|turkish|russian|chinese|mandarin|japanese|korean|portuguese|italian|dutch|swedish|norwegian|danish|finnish|polish|czech|hungarian|greek|hebrew|hindi|urdu|malay|indonesian|thai|vietnamese|persian|farsi)$/i;
    const loiPatterns = [
      { pattern: /(?:language\s+of\s+instruction|medium\s+of\s+instruction|MOI|instruction\s+language)[:\s|]+([A-Za-z]+(?:\s*(?:\/|and|,)\s*[A-Za-z]+)?)/i, confidence: 0.80 },
      { pattern: /([A-Za-z]+)\s+is\s+the\s+(?:language|medium)\s+of\s+instruction/i, confidence: 0.80 },
      { pattern: /(?:taught\s+(?:exclusively\s+)?in)\s+([A-Za-z]+)/i, confidence: 0.75 },
      { pattern: /(?:programs?\s+(?:are\s+)?(?:offered|taught|delivered|conducted)\s+(?:entirely\s+)?in)\s+([A-Za-z]+)/i, confidence: 0.75 },
      { pattern: /(?:all\s+(?:courses?|classes?|lectures?)\s+(?:are\s+)?(?:in|delivered\s+in|taught\s+in))\s+([A-Za-z]+)/i, confidence: 0.70 },
      { pattern: /medium\s+of\s+instruction\s+\(MOI\)/i, confidence: 0.65 },
    ];
    for (const { pattern, confidence } of loiPatterns) {
      const loiMatch = md.match(pattern);
      if (loiMatch && loiMatch[1]) {
        const lang = loiMatch[1].trim().slice(0, 50);
        if (KNOWN_LANGUAGES.test(lang) && lang.length >= 3) {
          const ctxStart = Math.max(0, (loiMatch.index || 0) - 80);
          const ctxEnd = Math.min(md.length, (loiMatch.index || 0) + loiMatch[0].length + 80);
          facts.push({ fact_group: "language_requirements", field_name: "language_of_instruction", value_raw: lang, evidence_snippet: md.substring(ctxStart, ctxEnd).slice(0, 300), confidence });
          break;
        }
      }
    }

    // Fallback: generic language section if nothing specific was found
    const anyLangFound = facts.some(f => f.fact_group === "language_requirements");
    if (!anyLangFound) {
      const langSection = md.match(/(?:language|proficiency|dil\s+(?:yeterli|şart|koşul))[^]*?(?:\n\n|\n#{1,3}|\Z)/i);
      if (langSection) facts.push({ fact_group: "language_requirements", field_name: "language_info", value_raw: langSection[0].slice(0, 1000), evidence_snippet: langSection[0].slice(0, 300), confidence: 0.6 });
    }
  }

  // ── ECTS / Credits extraction ──
  if (factGroups.includes("programs") || factGroups.includes("admissions")) {
    const ectsPatterns = [
      /(\d{2,3})\s*ECTS\s*(?:credits?)?/i,
      /ECTS[:\s]*(\d{2,3})/i,
      /(?:credits?|credit\s+points?)[:\s]*(\d{2,3})\s*(?:ECTS)?/i,
      /(\d{2,3})\s*(?:credit\s*(?:points?|hours?))\b/i,
    ];
    for (const ep of ectsPatterns) {
      const ectsMatch = md.match(ep);
      if (ectsMatch) {
        const val = parseInt(ectsMatch[1], 10);
        if (val >= 15 && val <= 360) {
          const idx = ectsMatch.index || 0;
          facts.push({ fact_group: "programs", field_name: "ects_credits", value_raw: String(val), evidence_snippet: md.substring(Math.max(0, idx - 40), Math.min(md.length, idx + ectsMatch[0].length + 80)).slice(0, 300), confidence: 0.80 });
          break;
        }
      }
    }
  }

  // ── Institutional Offices extraction (v4.5 — HTML-table-first + text fallback) ──
  if (factGroups.includes("contact_location") || factGroups.includes("admissions")) {
    // Strategy 1: Parse office tables from HTML (e.g., SPbPU admission-offices page)
    // Tables with columns like "Name of program | E-mail | Office | Telephone"
    let officeRowsFromTable = 0;
    if (/admission.?office|visa|international.?office/i.test(pageUrl)) {
      for (const table of mainHtmlTables) {
        if (table.length < 2) continue;
        const headers = table[0].map(h => h.toLowerCase());
        const hasEmail = headers.some(h => /e-?mail/i.test(h));
        const hasOffice = headers.some(h => /office|room|кабинет/i.test(h));
        const hasPhone = headers.some(h => /phone|tel|telephone|телефон/i.test(h));
        if (!hasEmail && !hasPhone) continue;

        const emailCol = headers.findIndex(h => /e-?mail/i.test(h));
        const officeCol = headers.findIndex(h => /office|room|кабинет/i.test(h));
        const phoneCol = headers.findIndex(h => /phone|tel|telephone|телефон/i.test(h));
        const progCol = headers.findIndex(h => /name|program|programme|направлен/i.test(h));

        for (const row of table.slice(1)) {
          const programs = progCol >= 0 ? (row[progCol] || "").trim() : "";
          const emails = emailCol >= 0 ? (row[emailCol] || "").trim() : "";
          const office = officeCol >= 0 ? (row[officeCol] || "").trim() : "";
          const phone = phoneCol >= 0 ? (row[phoneCol] || "").trim() : "";

          if (!emails && !phone) continue;

          // Extract all emails from cell
          const allEmails = [...emails.matchAll(/[\w.+-]+@[\w.-]+\.\w{2,}/g)].map(m => m[0]);
          const allPhones = [...phone.matchAll(/(?:\+7|8)\s*\(?\d{3,4}\)?[\s.-]*\d{2,4}[\s.-]*\d{2,4}(?:[\s.-]*\d{2,4})?/g)].map(m => m[0].trim());

          const officeRecord = {
            programs: programs.replace(/\n/g, "; ").slice(0, 500),
            emails: allEmails,
            office_room: office || null,
            phones: allPhones,
          };

          facts.push({
            fact_group: "contact_location",
            field_name: "admission_office_record",
            value_raw: JSON.stringify(officeRecord),
            evidence_snippet: `${programs.slice(0, 100)} | ${allEmails.join(", ")} | Room ${office} | ${allPhones.join(", ")}`.slice(0, 300),
            confidence: 0.90,
          });
          officeRowsFromTable++;
        }
      }
    }

    // Extract page-level address (e.g., "Address: 195220 Russia, St. Petersburg, 28, Grazhdansky pr.")
    if (/admission.?office/i.test(pageUrl)) {
      const addrMatch = contentMd.match(/(?:address)[:\s]*([^\n]{15,200})/i);
      if (addrMatch) {
        facts.push({ fact_group: "contact_location", field_name: "admission_office_address", value_raw: addrMatch[1].trim(), evidence_snippet: addrMatch[0].slice(0, 300), confidence: 0.88 });
      }
    }

    // Strategy 2: Text-based fallback for offices not found in tables
    const OFFICE_PATTERNS: Array<{ type: string; pattern: RegExp }> = [
      { type: "admission", pattern: /(?:admission[s]?\s+office|office\s+of\s+admission|kabul\s+ofis|приёмная\s+комиссия|приемная\s+комиссия)/i },
      { type: "visa", pattern: /(?:visa\s+(?:office|support|assistance|service)|immigration\s+(?:office|service)|vize\s+(?:ofis|hizmet)|визов)/i },
      { type: "international", pattern: /(?:international\s+(?:office|relations|affairs|students?\s+office)|uluslararası\s+(?:ofis|ilişkiler)|международн)/i },
    ];
    for (const { type, pattern } of OFFICE_PATTERNS) {
      const officeMatch = md.match(new RegExp(pattern.source + "[^]*?(?:\\n\\n|\\n#{1,3}\\s|\\Z)", "i"));
      if (officeMatch) {
        const block = officeMatch[0].slice(0, 1500);
        const offEmail = block.match(/[\w.+-]+@[\w.-]+\.\w{2,}/);
        if (offEmail) {
          facts.push({ fact_group: "contact_location", field_name: `office_${type}_email`, value_raw: offEmail[0], evidence_snippet: block.slice(0, 300), confidence: 0.80 });
        }
        const offPhone = block.match(/(?:\+7|8)\s*\(?\d{3,4}\)?[\s.-]*\d{2,4}[\s.-]*\d{2,4}(?:[\s.-]*\d{2,4})?/);
        if (offPhone) {
          facts.push({ fact_group: "contact_location", field_name: `office_${type}_phone`, value_raw: offPhone[0], evidence_snippet: block.slice(0, 300), confidence: 0.75 });
        }
        const offUrlMatch = block.match(/https?:\/\/[^\s"'<>]+/);
        if (offUrlMatch) {
          facts.push({ fact_group: "contact_location", field_name: `office_${type}_url`, value_raw: offUrlMatch[0], evidence_snippet: block.slice(0, 300), confidence: 0.70 });
        }
        const nameMatch = block.match(/^[^\n]{5,100}/);
        if (nameMatch) {
          facts.push({ fact_group: "contact_location", field_name: `office_${type}_name`, value_raw: nameMatch[0].replace(/^#+\s*/, "").trim(), evidence_snippet: block.slice(0, 300), confidence: 0.70 });
        }
        const hoursMatch = block.match(/(?:office\s+hours?|working\s+hours?|opening\s+hours?|çalışma\s+saatleri|часы\s+работы)[:\s]*([^\n]{5,150})/i);
        if (hoursMatch) {
          facts.push({ fact_group: "contact_location", field_name: `office_${type}_office_hours`, value_raw: hoursMatch[1].trim(), evidence_snippet: hoursMatch[0].slice(0, 200), confidence: 0.70 });
        }
        const locMatch = block.match(/(?:room|building|floor|office|address|adres|кабинет|этаж|здание)[:\s]*([^\n]{5,150})/i);
        if (locMatch) {
          facts.push({ fact_group: "contact_location", field_name: `office_${type}_location`, value_raw: locMatch[1].trim(), evidence_snippet: locMatch[0].slice(0, 200), confidence: 0.65 });
        }
      }
    }
  }

  // ── Programs ──
  if (factGroups.includes("programs")) {
    const programHeaders = [...md.matchAll(/(?:bachelor|master|phd|doctorate|lisans|бакалавриат|магистратура|программ|mühendislik|fakülte|fakulte|engineering|medicine|law|business|science)[^\n]*/gi)];
    if (programHeaders.length > 0) {
      facts.push({ fact_group: "programs", field_name: "programs_detected", value_raw: `${programHeaders.length} program mentions`, evidence_snippet: programHeaders.slice(0, 5).map(m => m[0].trim().slice(0, 80)).join(" | "), confidence: 0.5 });
    }
  }

  // ── Housing (v4.4 — HTML-table-aware living-costs/accommodation extraction) ──
  if (factGroups.includes("housing")) {
    const structuredLivingCosts = /living.?cost/i.test(pageUrl) ? extractLivingCostFactsFromHtmlTables(mainHtmlTables, facts) + extractLivingCostFactsFromMarkdown(contentMd, facts) : 0;
    // Also extract accommodation facts directly from raw HTML (bypasses markdown loss)
    const rawHtmlText = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
    const structuredAccommodation = /accommodat/i.test(pageUrl) ? extractAccommodationFactsFromContent(contentMd, facts) + extractAccommodationFactsFromMarkdown(contentMd, facts) + extractAccommodationFromRawHtml(rawHtmlText, facts) : 0;

    const housingPattern = /(?:dormitor|residence.?hall|student.?housing|hostel|accommodation|on.?campus|общежити|yurt|öğrenci.?evi|ogrenci.?evi|barınma|barinma)[^]*?(?:\n\n|\n#{1,3}|\Z)/i;
    const housingMatch = contentMd.match(housingPattern);
    if (housingMatch) {
      facts.push({ fact_group: "housing", field_name: "housing_info", value_raw: housingMatch[0].slice(0, 2000), evidence_snippet: housingMatch[0].slice(0, 300), confidence: 0.75 });

      const housingCtx = housingMatch[0];
      const housingPricePatterns = [
        /(?:£|€|\$|₺|₽)\s*([\d.,\s]+)\s*(?:per\s+(?:week|month|year|annum|semester|term)|\/\s*(?:week|month|year|term))/i,
        /([\d.,\s]+)\s*(?:TL|TRY|USD|EUR|GBP|RUB|RUR)\s*(?:per\s+(?:week|month|year|annum|semester|term))?/i,
        /(?:cost|price|rent|fee|ücret|fiyat|стоимость)[:\s]*(?:£|€|\$|₺|₽)?\s*([\d.,\s]+)/i,
      ];
      for (const pp of housingPricePatterns) {
        const priceMatch = housingCtx.match(pp);
        if (priceMatch) {
          facts.push({ fact_group: "housing", field_name: "housing_price", value_raw: priceMatch[0].trim().slice(0, 200), evidence_snippet: priceMatch[0].trim().slice(0, 200), confidence: 0.70 });
          break;
        }
      }

      const conditionsMatch = housingCtx.match(/(?:facilities|amenities|room\s+types?|single|shared|en-suite|self-catered|catered|internet|wifi|laundry)[^]*?(?:\n\n|\Z)/i);
      if (conditionsMatch) {
        facts.push({ fact_group: "housing", field_name: "housing_conditions", value_raw: conditionsMatch[0].slice(0, 1000), evidence_snippet: conditionsMatch[0].slice(0, 300), confidence: 0.65 });
      }

      const locationMatch = housingCtx.match(/(?:located|minutes?\s+(?:walk|from)|campus|city\s+centre|nearby|yakın|рядом|адрес)[^]*?(?:\n\n|\Z)/i);
      if (locationMatch) {
        facts.push({ fact_group: "housing", field_name: "housing_location", value_raw: locationMatch[0].slice(0, 500), evidence_snippet: locationMatch[0].slice(0, 200), confidence: 0.60 });
      }
    }

    if (structuredLivingCosts > 0) {
      facts.push({ fact_group: "housing", field_name: "living_costs_rows_detected", value_raw: String(structuredLivingCosts), evidence_snippet: `Structured living-cost rows parsed: ${structuredLivingCosts}`, confidence: 0.9 });
    }
    if (structuredAccommodation > 0) {
      facts.push({ fact_group: "housing", field_name: "accommodation_rows_detected", value_raw: String(structuredAccommodation), evidence_snippet: `Structured accommodation facts parsed: ${structuredAccommodation}`, confidence: 0.9 });
    }

    const housingImgMatch = html.match(/<img[^>]+src="([^"]+(?:dorm|residence|accommodation|housing|hostel|yurt)[^"]*)"[^>]*>/i);
    if (housingImgMatch) {
      try {
        const imgUrl = new URL(housingImgMatch[1], pageUrl).href;
        facts.push({ fact_group: "housing", field_name: "housing_image", value_raw: imgUrl, evidence_snippet: `Housing image: ${imgUrl}`, confidence: 0.60 });
      } catch {}
    }
  }

  // ── Identity: Leadership extraction (v4.1 — rector/president/chancellor) ──
  if (factGroups.includes("identity")) {
    // Leadership name extraction — multiple strategies
    const LEADER_TITLES_RE = /(?:rector|president|chancellor|provost|vice[\s-]?chancellor|vc|rektör|rektor|ректор|президент)/i;
    const NAME_FRAG = `(?:(?:Prof(?:essor)?\\.?\\s+)?(?:Dr\\.?\\s+)?[A-ZÀ-ÖÙ-Üa-zA-ZА-Яа-я][a-zà-öù-üа-я]+(?:\\s+[A-ZÀ-ÖÙ-Üa-zA-ZА-Яа-я][a-zà-öù-üа-я]+){1,4})`;
    const leaderPatterns: RegExp[] = [
      // "President: Dr. John Smith" or "Rector Prof. Dr. Name"
      new RegExp(`(?:rector|president|chancellor|provost|vice[\\s-]?chancellor|rektör|rektor|ректор|президент)[:\\s]+${NAME_FRAG}`, "i"),
      // "Message from the President Dr. Name"
      new RegExp(`message\\s+from\\s+(?:the\\s+)?(?:rector|president|chancellor|vice[\\s-]?chancellor)[:\\s]*${NAME_FRAG}`, "i"),
      // "Prof. Dr. Name, Rector" or "Dr. Name, President"
      new RegExp(`${NAME_FRAG}\\s*,\\s*(?:rector|president|chancellor|vice[\\s-]?chancellor|rektör|ректор)`, "i"),
      // Heading-based: "## Dr. Name" on a page whose URL contains leadership/president/rector/chancellor
      ...(/(leadership|president|rector|chancellor|vice-chancellor)/i.test(pageUrl)
        ? [new RegExp(`#{1,3}\\s+${NAME_FRAG}`, "i")]
        : []),
    ];

    let rectorNameFound = false;
    for (const lp of leaderPatterns) {
      const leaderMatch = md.match(lp);
      if (leaderMatch) {
        // Extract the name portion: strip the title prefix/suffix
        let raw = leaderMatch[0];
        // Remove heading markers
        raw = raw.replace(/^#{1,3}\s+/, "");
        // Remove title keywords at start
        raw = raw.replace(/^(?:rector|president|chancellor|provost|vice[\s-]?chancellor|vc|rektör|rektor|ректор|президент|message\s+from\s+(?:the\s+)?(?:rector|president|chancellor|vice[\s-]?chancellor))[:\s]*/i, "");
        // Remove trailing title
        raw = raw.replace(/\s*,\s*(?:rector|president|chancellor|vice[\s-]?chancellor|rektör|ректор)\s*$/i, "");
        const name = raw.trim();
        if (name.length > 4 && name.length < 80) {
          const idx = leaderMatch.index || 0;
          facts.push({ fact_group: "identity", field_name: "rector_name", value_raw: name, evidence_snippet: md.substring(Math.max(0, idx - 40), Math.min(md.length, idx + leaderMatch[0].length + 80)).slice(0, 300), confidence: 0.70 });
          rectorNameFound = true;
          break;
        }
      }
    }

    // Rector title — only emit if we found a name, to avoid noisy single-word matches
    if (rectorNameFound) {
      const titleContextRe = /\b(rector|president|chancellor|provost|vice[\s-]?chancellor|rektör|rektor|ректор|президент)\b/i;
      const titleMatch = md.match(titleContextRe);
      if (titleMatch) {
        facts.push({ fact_group: "identity", field_name: "rector_title", value_raw: titleMatch[0].trim(), evidence_snippet: titleMatch[0].trim(), confidence: 0.70 });
      }
    }

    // Rector message
    const msgPatterns = [
      /(?:message\s+from\s+(?:the\s+)?(?:rector|president|chancellor|vice[\s-]?chancellor))[:\s]*([^]*?)(?=\n#{1,3}\s|\n\n\n|$)/i,
      /(?:rector'?s?\s+message|president'?s?\s+message|chancellor'?s?\s+message)[:\s]*([^]*?)(?=\n#{1,3}\s|\n\n\n|$)/i,
    ];
    for (const mp of msgPatterns) {
      const msgMatch = md.match(mp);
      if (msgMatch && msgMatch[1] && msgMatch[1].length > 50) {
        facts.push({ fact_group: "identity", field_name: "rector_message", value_raw: msgMatch[1].trim().slice(0, 3000), evidence_snippet: msgMatch[1].trim().slice(0, 300), confidence: 0.65 });
        break;
      }
    }

    // Rector image — also check src before alt (some pages put src first)
    const rectorImgPatterns = [
      /<img[^>]+(?:alt|title)="[^"]*(?:rector|president|chancellor|rektör|ректор)[^"]*"[^>]+src="([^"]+)"/i,
      /<img[^>]+src="([^"]+)"[^>]+(?:alt|title)="[^"]*(?:rector|president|chancellor|rektör|ректор)[^"]*"/i,
      /<img[^>]+src="([^"]+(?:rector|president|chancellor|leadership)[^"]*)"[^>]*>/i,
    ];
    for (const rip of rectorImgPatterns) {
      const imgMatch = html.match(rip);
      if (imgMatch) {
        try {
          const imgUrl = new URL(imgMatch[1], pageUrl).href;
          facts.push({ fact_group: "identity", field_name: "rector_image_url", value_raw: imgUrl, evidence_snippet: `Leadership image: ${imgUrl}`, confidence: 0.60 });
        } catch {}
        break;
      }
    }

    // Founded year
    const foundedMatch = md.match(/(?:founded|established|since|kuruluş|kurulusu|основан)\s+(?:in\s+)?(\d{4})/i);
    if (foundedMatch) {
      const year = parseInt(foundedMatch[1], 10);
      if (year >= 800 && year <= 2025) {
        facts.push({ fact_group: "identity", field_name: "founded_year", value_raw: String(year), evidence_snippet: foundedMatch[0].slice(0, 200), confidence: 0.80 });
      }
    }
    
    // Student count
    const studentCountMatch = md.match(/(?:(?:over|more\s+than|approximately|around|circa)?\s*)([\d,\.]+)\s*(?:students|öğrenci|студент)/i);
    if (studentCountMatch) {
      const count = parseInt(studentCountMatch[1].replace(/[,\.]/g, ""), 10);
      if (count >= 100 && count <= 500000) {
        facts.push({ fact_group: "identity", field_name: "total_students", value_raw: String(count), evidence_snippet: studentCountMatch[0].slice(0, 200), confidence: 0.65 });
      }
    }
  }

  // ══ STUDENT LIFE — v3.1 improved ══
  if (factGroups.includes("student_life")) {
    extractStudentLife(md, facts);
  }

  // ── Media/Brochures (v4.0 — file artifact discovery + v4.1 brochure URL extraction) ──
  if (factGroups.includes("media_brochures")) {
    // PDF links
    const pdfLinks = [...html.matchAll(/href="([^"]+\.pdf)"/gi)];
    if (pdfLinks.length > 0) {
      const urls = pdfLinks.map(m => { try { return new URL(m[1], pageUrl).href; } catch { return null; } }).filter(Boolean);
      if (urls.length > 0) facts.push({ fact_group: "media_brochures", field_name: "brochure_links", value_raw: JSON.stringify(urls.slice(0, 10)), evidence_snippet: `Found ${urls.length} PDF links`, confidence: 0.7 });
    }
    
    // Downloadable document links (DOCX, XLSX, etc.)
    const docLinks = [...html.matchAll(/href="([^"]+\.(?:docx?|xlsx?|pptx?))"/gi)];
    if (docLinks.length > 0) {
      const urls = docLinks.map(m => { try { return new URL(m[1], pageUrl).href; } catch { return null; } }).filter(Boolean);
      if (urls.length > 0) facts.push({ fact_group: "media_brochures", field_name: "document_links", value_raw: JSON.stringify(urls.slice(0, 5)), evidence_snippet: `Found ${urls.length} document links`, confidence: 0.6 });
    }

    // v4.1: Extract brochure/leaflet/prospectus download URLs from anchor context
    // Catches patterns like: <a href="..." download>click to download</a> near "leaflet"/"brochure"/"prospectus"
    // Also catches direct <a> links whose text or surrounding context mentions brochure/leaflet/prospectus
    const brochureContextPattern = /brochure|leaflet|prospectus|course\s+(?:guide|booklet)|programme\s+(?:guide|leaflet)|tanıtım|tanitim|broşür|brosur|брошюра|буклет|نشرة|كتيب/i;
    const brochureUrls: Array<{ url: string; text: string; context: string }> = [];

    // Method 1: <a> tags with download attribute
    const downloadLinks = [...html.matchAll(/<a\s[^>]*download[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi),
                           ...html.matchAll(/<a\s[^>]*href="([^"]+)"[^>]*download[^>]*>([\s\S]*?)<\/a>/gi)];
    for (const m of downloadLinks) {
      const href = m[1];
      const linkText = m[2].replace(/<[^>]*>/g, "").trim();
      // Check 200-char window around the match for brochure context
      const matchIdx = html.indexOf(m[0]);
      const window = html.slice(Math.max(0, matchIdx - 200), matchIdx + m[0].length + 200);
      if (brochureContextPattern.test(linkText) || brochureContextPattern.test(window)) {
        try {
          brochureUrls.push({ url: new URL(href, pageUrl).href, text: linkText, context: window.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200) });
        } catch { /* invalid URL */ }
      }
    }

    // Method 2: <a> tags whose text directly mentions brochure/leaflet/prospectus
    const allAnchors = [...html.matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
    for (const m of allAnchors) {
      const href = m[1];
      const linkText = m[2].replace(/<[^>]*>/g, "").trim();
      if (brochureContextPattern.test(linkText) && !href.startsWith("javascript:") && !href.startsWith("#")) {
        const url = (() => { try { return new URL(href, pageUrl).href; } catch { return null; } })();
        if (url && !brochureUrls.some(b => b.url === url)) {
          brochureUrls.push({ url, text: linkText, context: linkText });
        }
      }
    }

    // Method 3: Check for leaflet/prospectus dialog pattern (Liverpool-style)
    // Pattern: <a ... href="URL" ...> inside <dialog id="get-leaflet-dialog"> or similar
    const dialogPattern = /<dialog[^>]*id="[^"]*(?:leaflet|prospectus|brochure)[^"]*"[^>]*>([\s\S]*?)<\/dialog>/gi;
    for (const dm of html.matchAll(dialogPattern)) {
      const dialogHtml = dm[1];
      const dialogAnchors = [...dialogHtml.matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
      for (const a of dialogAnchors) {
        const href = a[1];
        if (href.includes("geckoform") || href.startsWith("#")) continue; // Skip form embeds
        const linkText = a[2].replace(/<[^>]*>/g, "").trim();
        const url = (() => { try { return new URL(href, pageUrl).href; } catch { return null; } })();
        if (url && !brochureUrls.some(b => b.url === url)) {
          brochureUrls.push({ url, text: linkText, context: `Dialog: ${dm[0].slice(0, 50)}...` });
        }
      }
    }

    if (brochureUrls.length > 0) {
      facts.push({
        fact_group: "media_brochures",
        field_name: "program_brochure_url",
        value_raw: JSON.stringify(brochureUrls.map(b => b.url)),
        evidence_snippet: brochureUrls.map(b => `"${b.text}" → ${b.url}`).join(" | ").slice(0, 500),
        confidence: 0.85,
      });
    }
  }

  // ══ CTA LINKS — v3.1 major improvement ══
  if (factGroups.includes("cta_links")) {
    extractCTALinks(html, pageUrl, facts);
  }

  return facts;
}

function stripMdFormatting(v: string): string {
  return v
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\\_/g, "_")
    .replace(/\u00a0/g, " ")
    .replace(/\s+$/gm, "")
    .trim();
}

function parseMarkdownTables(md: string): string[][][] {
  const lines = md.split("\n");
  const tables: string[][][] = [];
  let current: string[][] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("|") && line.endsWith("|")) {
      const cells = line.slice(1, -1).split("|").map(c => stripMdFormatting(c.trim()));
      const isDivider = cells.every(c => /^:?-{2,}:?$/.test(c) || c === "");
      if (!isDivider) current.push(cells);
    } else if (current.length > 0) {
      tables.push(current);
      current = [];
    }
  }
  if (current.length > 0) tables.push(current);
  return tables;
}

function parseRubleValues(text: string): number[] {
  const t = text.replace(/\u00a0/g, " ").replace(/,/g, "");
  const out: number[] = [];
  // Match number groups like "332 200" but stop at double-space or non-digit/space
  const matches = [...t.matchAll(/\b(\d{1,3}(?:\s\d{3})*)\b/g)];
  for (const m of matches) {
    const v = parseInt(m[1].replace(/\s+/g, ""), 10);
    if (Number.isFinite(v) && v >= 50 && v <= 9_000_000) out.push(v);
  }
  // Also match plain integers without spaces (e.g. "332200")
  if (out.length === 0) {
    const plain = [...t.matchAll(/\b(\d{4,7})\b/g)];
    for (const m of plain) {
      const v = parseInt(m[1], 10);
      if (Number.isFinite(v) && v >= 50 && v <= 9_000_000) out.push(v);
    }
  }
  return [...new Set(out)];
}

/** Parse fee values from individual cells rather than joining them */
function parseFeeCellsIndividually(cells: string[]): number[] {
  const values: number[] = [];
  for (const cell of cells) {
    const parsed = parseRubleValues(cell);
    if (parsed.length > 0) values.push(parsed[0]);
  }
  return values;
}
// ─── Deadline extraction from HTML tables (v4.4) ───
function extractDeadlineFactsFromHtmlTables(htmlTables: string[][][], facts: ExtractedFact[]): number {
  const dateRe = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4}|\d{2}\.\d{2}\.\d{4}/gi;
  let count = 0;

  for (const table of htmlTables) {
    for (const row of table) {
      if (row.length < 2) continue;
      const label = row[0].trim();
      const value = row.slice(1).join(" ").trim();
      const dates = [...value.matchAll(dateRe)].map(x => x[0]);
      if (dates.length === 0) continue;

      for (const d of dates) {
        // Try to extract context near the date
        const dateIdx = value.indexOf(d);
        const context = value.slice(Math.max(0, dateIdx - 60), dateIdx + d.length + 60).trim();
        facts.push({
          fact_group: "deadlines_intakes",
          field_name: "application_deadline",
          value_raw: `${label || "deadline"}: ${d}`.slice(0, 500),
          evidence_snippet: `${label} | ${context}`.slice(0, 300),
          confidence: 0.92,
        });
        count++;
      }
    }
  }
  return count;
}

function extractDeadlineFactsFromMarkdown(md: string, facts: ExtractedFact[]): number {
  // Match date patterns like "July 20, 2025" or "01.07.2025"
  const monthDateRe = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4}/gi;
  const ddmmDateRe = /(\d{2}\.\d{2}\.\d{4})/g;

  const sectionMatch = md.match(/(?:APPLICATION\s+DEADLINE|IMPORTANT\s+DATES|deadline)[^\n]*\n([\s\S]*?)(?=\n#{1,4}\s|\Z)/i);
  const section = sectionMatch ? sectionMatch[1] : md;
  let count = 0;

  // Strategy 1: Parse markdown tables with dates
  const tables = parseMarkdownTables(section);
  for (const table of tables) {
    for (const row of table) {
      if (row.length < 2) continue;
      const label = stripMdFormatting(row[0]).replace(/^\*+|\*+$/g, "").trim();
      const value = stripMdFormatting(row[1]);
      const dates = [...value.matchAll(monthDateRe), ...value.matchAll(ddmmDateRe)].map(x => x[0].replace(/\*+/g, ""));
      for (const d of dates) {
        facts.push({
          fact_group: "deadlines_intakes",
          field_name: "application_deadline",
          value_raw: `${label || "application"}: ${d}`.slice(0, 500),
          evidence_snippet: `${label || "application"} | ${value}`.slice(0, 300),
          confidence: 0.9,
        });
        count++;
      }
    }
  }

  // Strategy 2: Extract dates from inline text (handles bold-wrapped dates like **July 01, 2025**)
  if (count === 0) {
    // Find all lines/paragraphs containing dates near deadline keywords
    const lines = section.split("\n");
    for (const line of lines) {
      if (!/deadline|admission|enrollment|apply|tuition.*payment/i.test(line)) continue;
      const allDates = [...line.matchAll(monthDateRe), ...line.matchAll(ddmmDateRe)].map(x => x[0].replace(/\*+/g, ""));
      for (const d of allDates) {
        // Try to extract a label from before the date
        const dateIdx = line.indexOf(d.replace(/\*+/g, ""));
        const beforeDate = line.slice(0, Math.max(0, dateIdx)).replace(/[*#\[\]]/g, "").trim();
        const label = beforeDate.length > 5 ? beforeDate.slice(-80).trim() : "application";
        facts.push({
          fact_group: "deadlines_intakes",
          field_name: "application_deadline",
          value_raw: `${label}: ${d}`.slice(0, 500),
          evidence_snippet: line.replace(/\*+/g, "").slice(0, 300),
          confidence: 0.85,
        });
        count++;
      }
    }
  }

  // Extract start of academic year
  const startYear = section.match(/Start\s+of\s+the\s+academic\s+year[^:]*:\s*\*{0,2}([^\n*]+)/i);
  if (startYear) {
    facts.push({
      fact_group: "deadlines_intakes",
      field_name: "academic_year_start",
      value_raw: stripMdFormatting(startYear[1]).slice(0, 200),
      evidence_snippet: startYear[0].slice(0, 300),
      confidence: 0.86,
    });
    count++;
  }

  return count;
}

function extractLivingCostFactsFromMarkdown(md: string, facts: ExtractedFact[]): number {
  const lines = md.split("\n");
  let section = "";
  let count = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const heading = line.match(/^#{3,4}\s*(?:\[[^\]]+\]\([^)]*\)|(.+))$/i);
    if (heading) {
      section = stripMdFormatting(heading[1] || line.replace(/^#{3,4}\s*/, ""));
      continue;
    }
    if (!line.startsWith("|") || !line.endsWith("|")) continue;

    const cells = line.slice(1, -1).split("|").map(c => stripMdFormatting(c.trim()));
    if (cells.length < 2) continue;
    if (cells.every(c => /^:?-{2,}:?$/.test(c) || c === "")) continue;
    const item = cells[0] || "general";
    const cost = cells[1] || "";
    if (!/\d/.test(cost)) continue;

    const nums = parseRubleValues(cost);
    const payload = {
      section,
      item,
      cost_text: cost,
      min_rub: nums.length > 0 ? Math.min(...nums) : null,
      max_rub: nums.length > 0 ? Math.max(...nums) : null,
      currency: /₽|rub|rur/i.test(cost) ? "RUB" : null,
    };

    facts.push({
      fact_group: "housing",
      field_name: "living_cost_item",
      value_raw: JSON.stringify(payload).slice(0, 5000),
      evidence_snippet: `${section} | ${item} | ${cost}`.slice(0, 300),
      confidence: 0.88,
    });
    count++;
  }

  return count;
}

function extractAccommodationFactsFromMarkdown(md: string, facts: ExtractedFact[]): number {
  let count = 0;

  for (const m of md.matchAll(/"on\s+([^"]+)"/gi)) {
    facts.push({ fact_group: "housing", field_name: "accommodation_complex", value_raw: m[1].trim(), evidence_snippet: m[0], confidence: 0.85 });
    count++;
  }

  for (const m of md.matchAll(/dormitory\s*(?:№|#|no\.?\s*|number\s*)?(\d+)/gi)) {
    facts.push({ fact_group: "housing", field_name: "accommodation_dormitory", value_raw: `Dormitory №${m[1]}`, evidence_snippet: m[0], confidence: 0.82 });
    count++;
  }

  const occupancy = md.match(/students\s+live\s+with\s+([\d,\sor]+)\s+persons?\s+in\s+each\s+room/i);
  if (occupancy) {
    facts.push({ fact_group: "housing", field_name: "accommodation_room_occupancy", value_raw: occupancy[1].replace(/\s+/g, " ").trim(), evidence_snippet: occupancy[0].slice(0, 300), confidence: 0.8 });
    count++;
  }

  const price = md.match(/(\d[\d\s]{2,})\s*(?:to|[-–])\s*(\d[\d\s]{2,})\s*rubles?/i);
  if (price) {
    const min = parseInt(price[1].replace(/\s+/g, ""), 10);
    const max = parseInt(price[2].replace(/\s+/g, ""), 10);
    const payload = { min_rub: min, max_rub: max, period: "month" };
    facts.push({ fact_group: "housing", field_name: "accommodation_price_range", value_raw: JSON.stringify(payload), evidence_snippet: price[0].slice(0, 300), confidence: 0.9 });
    count++;
  }

  return count;
}

// ─── Dedicated tuition/fees extractor (v4.4 — HTML-table-first) ───
function extractTuitionFees(md: string, html: string, pageUrl: string, facts: ExtractedFact[], htmlTables?: string[][][]): void {
  // Strategy 1: Parse HTML tables directly (bypasses markdown conversion issues)
  const tables = htmlTables && htmlTables.length > 0 ? htmlTables : extractHtmlTableRows(html);
  let rowsDetected = 0;
  let rowsStructured = 0;

  for (const table of tables) {
    if (table.length < 2) continue;
    const headers = table[0].map(h => h.toLowerCase());
    const hasField = headers.some(h => /field of study|program|programme|course|направлен/i.test(h));
    const hasTuition = headers.some(h => /visa|tuition|fee|academic year|rur|rub|стоимость/i.test(h));
    if (!hasField && !hasTuition) continue;

    for (const row of table.slice(1)) {
      if (row.length < 2) continue;
      rowsDetected++;

      const codeCell = (row[0] || "").trim();
      const fieldCell = (row[1] || "").trim();
      const feeCells = row.slice(2).map(c => (c || "").trim());
      const isCategoryRow = /\d{2}\.00\.00/.test(codeCell);

      // Parse fees from individual cells (NOT joined — avoids cross-cell number merge)
      const feeValues = parseFeeCellsIndividually(feeCells);
      const feeNonVisa = feeValues.length > 0 ? feeValues[0] : null;
      const feeVisa = feeValues.length > 1 ? feeValues[1] : null;

      // Extract program entries (code + title patterns)
      const rowText = `${codeCell} ${fieldCell}`;
      const entries: Array<{ code: string | null; title: string }> = [];

      // Look for sub-programs listed as bullet points in fieldCell
      const subPrograms = fieldCell.split("\n").filter(l => l.trim().startsWith("•") || /^\d{2}\.\d{2}\.\d{2}_\d{2}/.test(l.trim()));
      if (subPrograms.length > 0) {
        for (const sub of subPrograms) {
          const cleaned = sub.replace(/^[•\s]+/, "").trim();
          const codeMatch = cleaned.match(/^(\d{2}\.\d{2}\.\d{2}(?:_\d{2})?)\s+(.*)/);
          if (codeMatch) {
            entries.push({ code: codeMatch[1], title: codeMatch[2].trim() });
          } else if (cleaned.length >= 3) {
            entries.push({ code: null, title: cleaned });
          }
        }
      }

      // Also check for main program title in fieldCell (bold text before sub-items)
      const mainTitle = fieldCell.split("\n")[0]?.replace(/^[•\s]+/, "").trim();
      if (mainTitle && mainTitle.length >= 3 && !isCategoryRow && entries.length === 0) {
        const codeMatch = /\d{2}\.\d{2}\.\d{2}/.test(codeCell) ? codeCell.match(/\d{2}\.\d{2}\.\d{2}/)?.[0] : null;
        entries.push({ code: codeMatch || null, title: mainTitle });
      }

      // Also try regex for embedded codes
      if (entries.length === 0 && !isCategoryRow) {
        const programMatches = [...rowText.matchAll(/(\d{2}\.\d{2}\.\d{2}(?:_\d{2})?)\s+([^\n|]{3,180})/g)];
        for (const pm of programMatches) {
          entries.push({ code: pm[1]?.trim() || null, title: pm[2].replace(/^[-–]\s*/, "").trim() });
        }
      }

      for (const entry of entries) {
        if (entry.title.length < 3) continue;
        // Skip entries where title is just a number (misaligned fee value)
        if (/^\d[\d\s,]*$/.test(entry.title.trim())) continue;
        const payload = {
          source: "master_tuition_table",
          page: pageUrl,
          program_code: entry.code,
          program_title: entry.title,
          fee_non_visa_rub: feeNonVisa,
          fee_visa_rub: feeVisa,
          fee_currency: "RUB",
          degree_level: "master",
          duration_years: 2,
          language_of_instruction: /english/i.test(entry.title) ? "english" : null,
        };

        facts.push({
          fact_group: "tuition_fees",
          field_name: "fee_table_row",
          value_raw: JSON.stringify(payload).slice(0, 5000),
          evidence_snippet: `${entry.code || ""} ${entry.title} | ${feeCells.join(" | ")}`.slice(0, 300),
          confidence: 0.88,
          program_hint: entry.title,
        });
        rowsStructured++;
      }
    }
  }

  if (rowsDetected > 0) {
    facts.push({ fact_group: "tuition_fees", field_name: "tuition_table_rows_detected", value_raw: String(rowsDetected), evidence_snippet: `Detected rows in tuition table: ${rowsDetected}`, confidence: 0.9 });
    facts.push({ fact_group: "tuition_fees", field_name: "tuition_table_rows_structured", value_raw: String(rowsStructured), evidence_snippet: `Structured tuition program rows: ${rowsStructured}`, confidence: 0.9 });
    if (rowsStructured > 0) return;
  }

  // Fallback: markdown-based table parsing
  const mdTables = parseMarkdownTables(md);
  for (const table of mdTables) {
    if (table.length < 2) continue;
    const headers = table[0].map(h => h.toLowerCase());
    const hasField = headers.some(h => /field|program|course/i.test(h));
    const hasTuition = headers.some(h => /visa|tuition|fee|year|rub/i.test(h));
    if (!hasField && !hasTuition) continue;

    for (const row of table.slice(1)) {
      if (row.length < 2) continue;
      const title = stripMdFormatting(row[1] || row[0] || "").trim();
      const feeValues = parseRubleValues(row.slice(2).join(" "));
      if (title.length >= 3 && feeValues.length > 0) {
        const payload = { source: "tuition_table_md", page: pageUrl, program_title: title, fee_non_visa_rub: feeValues[0], fee_visa_rub: feeValues[1] || null, fee_currency: "RUB" };
        facts.push({ fact_group: "tuition_fees", field_name: "fee_table_row", value_raw: JSON.stringify(payload).slice(0, 5000), evidence_snippet: `${title} | ${feeValues.join(", ")}`.slice(0, 300), confidence: 0.85, program_hint: title });
        rowsStructured++;
      }
    }
  }

  if (rowsStructured > 0) return;

  // Fallback for non-tabular fee pages
  const feeKeywords = /tuition|fee|cost|price|annual|per\s*year|per\s*semester|rub|rur|usd|eur|gbp|₽|\$|€|£/i;
  if (!feeKeywords.test(md)) return;

  const fallbackAmounts = parseRubleValues(md).slice(0, 5);
  for (const v of fallbackAmounts) {
    facts.push({ fact_group: "tuition_fees", field_name: "fee_amount", value_raw: `${v} RUB`, evidence_snippet: `Detected fee amount candidate: ${v} RUB`, confidence: 0.65 });
  }
}

// ─── Living costs from HTML tables (v4.4) ───
function extractLivingCostFactsFromHtmlTables(htmlTables: string[][][], facts: ExtractedFact[]): number {
  let count = 0;
  for (const table of htmlTables) {
    if (table.length < 2) continue;
    // Check if this looks like a cost table (has numeric values with Rub/₽)
    const hasNumbers = table.some(row => row.some(cell => /\d+.*(?:rub|₽)/i.test(cell)));
    if (!hasNumbers) continue;

    for (const row of table.slice(0)) {
      if (row.length < 2) continue;
      const label = row[0].trim();
      const value = row[1].trim();
      if (!label || !value || label.length < 3) continue;
      // Skip header rows
      if (/^(home rental|cost|item|\s*$)/i.test(label) && /^(cost|price|amount|\s*$)/i.test(value)) continue;

      const numMatch = value.match(/(\d[\d\s,]*\d|\d+)/);
      if (numMatch) {
        const cleanNum = numMatch[1].replace(/[\s,]/g, "");
        facts.push({
          fact_group: "housing",
          field_name: "living_cost_item",
          value_raw: JSON.stringify({ label, value, amount_rub: parseInt(cleanNum, 10) }).slice(0, 500),
          evidence_snippet: `${label}: ${value}`.slice(0, 300),
          confidence: 0.88,
        });
        count++;
      }
    }
  }
  return count;
}

// ─── Accommodation from content (v4.5 — paragraph-based with flexible quote matching) ───
function extractAccommodationFactsFromContent(contentMd: string, facts: ExtractedFact[]): number {
  let count = 0;
  // Normalize smart/curly quotes to standard quotes for regex matching
  const normalized = contentMd
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'");
  const paragraphs = normalized.split(/\n{2,}/).filter(p => p.trim().length > 30);

  for (const para of paragraphs) {
    // Extract dormitory complex names — handles "on Lesnoy prospect" etc.
    const complexMatches = [...para.matchAll(/(?:complex(?:es)?|комплекс)\s+[""]([^""]+)[""]|[""]on\s+([^""]+)[""]|complex\s+"([^"]+)"|"on\s+([^"]+)"/gi)];
    for (const cm of complexMatches) {
      const name = (cm[1] || cm[2] || cm[3] || cm[4] || "").trim();
      if (name.length >= 3) {
        facts.push({ fact_group: "housing", field_name: "dormitory_complex", value_raw: name, evidence_snippet: para.slice(0, 300), confidence: 0.85 });
        count++;
      }
    }

    // Extract dormitory numbers
    const dormNumbers = [...para.matchAll(/dormitory\s+(?:№|#|no\.?\s*)(\d+)/gi)];
    for (const dn of dormNumbers) {
      facts.push({ fact_group: "housing", field_name: "dormitory_number", value_raw: `Dormitory №${dn[1]}`, evidence_snippet: para.slice(0, 300), confidence: 0.80 });
      count++;
    }

    // Extract housing price from text — more flexible patterns
    const pricePatterns = [
      /(\d[\d\s]*\d)\s*(?:to|–|—|-)\s*(\d[\d\s]*\d)\s*(?:rubles?|rub|₽)/i,
      /(\d[\d\s,]*)\s*(?:to|–|—|-)\s*(\d[\d\s,]*)\s*(?:rubles?|rub|₽)/i,
    ];
    for (const pp of pricePatterns) {
      const priceMatch = para.match(pp);
      if (priceMatch) {
        const low = parseInt(priceMatch[1].replace(/[\s,]/g, ""), 10);
        const high = parseInt(priceMatch[2].replace(/[\s,]/g, ""), 10);
        if (low > 0 && high > 0) {
          facts.push({
            fact_group: "housing",
            field_name: "accommodation_price_range",
            value_raw: JSON.stringify({ min_rub: low, max_rub: high, currency: "RUB", period: "month" }),
            evidence_snippet: priceMatch[0].slice(0, 300),
            confidence: 0.88,
          });
          count++;
          break;
        }
      }
    }

    // Extract room occupancy info — more flexible
    const occupancyMatch = para.match(/(?:with\s+)?(\d+(?:,\s*\d+)*(?:\s+or\s+\d+)?)\s+persons?\s+in\s+each\s+room/i)
      || para.match(/(\d+(?:\s*[-–]\s*\d+)?)\s*(?:bed|person|student)s?\s+(?:per|in\s+(?:a|each))\s+room/i);
    if (occupancyMatch) {
      facts.push({ fact_group: "housing", field_name: "room_occupancy", value_raw: occupancyMatch[1] + " persons per room", evidence_snippet: para.slice(0, 300), confidence: 0.80 });
      count++;
    }

    // Extract "foreign students live in..." details
    const foreignMatch = para.match(/foreign\s+(?:university\s+)?students\s+live\s+in\s+([^\n.]{10,200})/i);
    if (foreignMatch) {
      facts.push({ fact_group: "housing", field_name: "international_housing", value_raw: foreignMatch[1].trim(), evidence_snippet: para.slice(0, 300), confidence: 0.85 });
      count++;
    }

    // Extract facilities
    if (/Wi-Fi|internet|laundry|launderette|fitness|tennis|classroom|broadband|sportsground|video.?surveillance/i.test(para) && para.length > 50) {
      facts.push({ fact_group: "housing", field_name: "dormitory_facilities", value_raw: para.slice(0, 1000), evidence_snippet: para.slice(0, 300), confidence: 0.75 });
      count++;
    }

    // Extract security/access features
    if (/access.?control|pass|video.?surveillance|security/i.test(para) && para.length > 30) {
      facts.push({ fact_group: "housing", field_name: "dormitory_security", value_raw: para.slice(0, 500), evidence_snippet: para.slice(0, 200), confidence: 0.70 });
      count++;
    }
  }

  // Extract student count in dorms
  const studentCountMatch = normalized.match(/(?:over|more\s+than)\s+(\d[\d,]*)\s+students/i);
  if (studentCountMatch) {
    facts.push({ fact_group: "housing", field_name: "dormitory_capacity", value_raw: studentCountMatch[1].replace(/,/g, ""), evidence_snippet: studentCountMatch[0].slice(0, 200), confidence: 0.80 });
    count++;
  }

  // Extract number of complexes
  const complexCountMatch = normalized.match(/(\d+)\s+complexes?\s+of\s+dormitories/i);
  if (complexCountMatch) {
    facts.push({ fact_group: "housing", field_name: "dormitory_complex_count", value_raw: complexCountMatch[1], evidence_snippet: complexCountMatch[0].slice(0, 200), confidence: 0.85 });
    count++;
  }

  return count;
}

// ─── Accommodation from raw HTML text (bypasses markdown conversion loss) ───
function extractAccommodationFromRawHtml(text: string, facts: ExtractedFact[]): number {
  let count = 0;
  const seen = new Set<string>();

  for (const m of text.matchAll(/dormitory\s+(?:№|#|no\.?\s*|number\s*)?(\d+)/gi)) {
    const key = `dorm-${m[1]}`;
    if (seen.has(key)) continue; seen.add(key);
    facts.push({ fact_group: "housing", field_name: "accommodation_dormitory", value_raw: `Dormitory №${m[1]}`, evidence_snippet: text.slice(Math.max(0, m.index! - 40), m.index! + m[0].length + 40).trim(), confidence: 0.82 });
    count++;
  }

  const occ = text.match(/(?:students\s+live\s+with|live\s+with)\s+([\d,\s]+(?:or\s+\d+)?)\s+persons?\s+in\s+each\s+room/i);
  if (occ) {
    facts.push({ fact_group: "housing", field_name: "room_occupancy", value_raw: occ[1].replace(/\s+/g, " ").trim() + " persons per room", evidence_snippet: occ[0].slice(0, 300), confidence: 0.85 });
    count++;
  }

  const price = text.match(/(\d[\d\s]*\d)\s*(?:to|[–—-])\s*(\d[\d\s]*\d)\s*(?:rubles?|rub|₽)/i);
  if (price) {
    const low = parseInt(price[1].replace(/\s/g, ""), 10);
    const high = parseInt(price[2].replace(/\s/g, ""), 10);
    if (low > 0 && high > 0) {
      facts.push({ fact_group: "housing", field_name: "accommodation_price_range", value_raw: JSON.stringify({ min_rub: low, max_rub: high, currency: "RUB", period: "month" }), evidence_snippet: price[0].slice(0, 300), confidence: 0.88 });
      count++;
    }
  }

  const intl = text.match(/foreign\s+(?:university\s+)?students\s+live\s+in\s+([^.]{10,200})/i);
  if (intl) {
    facts.push({ fact_group: "housing", field_name: "international_housing", value_raw: intl[1].trim(), evidence_snippet: intl[0].slice(0, 300), confidence: 0.85 });
    count++;
  }

  return count;
}


function extractStudentLife(md: string, facts: ExtractedFact[]): void {
  // Multiple patterns for broader coverage
  const patterns = [
    { name: "campus_life", regex: /(?:student.?life|campus.?life|öğrenci.?yaşam|ogrenci.?yasam|kampüs.?yaşam|kampus.?yasam)[^]*?(?:\n\n|\n#{1,3}|\Z)/i },
    { name: "clubs", regex: /(?:student\s+club|kulüp|kulup|student\s+organization|student\s+activit|etkinlik)[^]*?(?:\n\n|\n#{1,3}|\Z)/i },
    { name: "sports", regex: /(?:sport|spor|gym|fitness|recreation|atletizm|swimming|basketball|football)[^]*?(?:\n\n|\n#{1,3}|\Z)/i },
    { name: "facilities", regex: /(?:facilit|library|kütüphane|kutuphane|laboratory|laborat|cafeteria|dining|yemekhane|kantin)[^]*?(?:\n\n|\n#{1,3}|\Z)/i },
    { name: "social", regex: /(?:social\s+life|sosyal\s+yaşam|sosyal\s+yasam|cultural|kültürel|kulturel|festival|event|topluluk)[^]*?(?:\n\n|\n#{1,3}|\Z)/i },
  ];

  for (const { name, regex } of patterns) {
    const match = md.match(regex);
    if (match && match[0].length > 30) {
      facts.push({
        fact_group: "student_life", field_name: `student_life_${name}`,
        value_raw: match[0].slice(0, 2000),
        evidence_snippet: match[0].slice(0, 300),
        confidence: 0.65,
      });
      break; // one match is enough
    }
  }
  
  // Count mentions as fallback signal
  const lifeKeywords = /club|sport|library|cafeteria|gym|kulüp|kulup|spor|kütüphane|kutuphane|yemekhane|kantin|topluluk/gi;
  const mentions = [...md.matchAll(lifeKeywords)];
  if (mentions.length >= 3 && facts.filter(f => f.fact_group === "student_life").length === 0) {
    facts.push({
      fact_group: "student_life", field_name: "student_life_mentions",
      value_raw: `${mentions.length} facility/activity mentions detected`,
      evidence_snippet: mentions.slice(0, 5).map(m => m[0]).join(", "),
      confidence: 0.5,
    });
  }
}

// ─── Dedicated CTA links extractor (v3.1) ───
function extractCTALinks(html: string, pageUrl: string, facts: ExtractedFact[]): void {
  const links = collectAnchorsWithText(html, pageUrl);
  
  const ctaPatterns: Array<{ field: string; urlPattern: RegExp; textPattern: RegExp }> = [
    { field: "apply_url", urlPattern: /apply|başvur|basvuru|application|kayıt|kayit|register/i, textPattern: /apply|başvur|basvuru|kayıt|kayit|register|application|enroll/i },
    { field: "inquiry_url", urlPattern: /inquiry|enquiry|info.?request|bilgi.?talep|soru/i, textPattern: /inquiry|enquiry|request\s+info|bilgi\s+al|soru\s+sor|ask|learn\s+more/i },
    { field: "contact_url", urlPattern: /contact|iletişim|iletisim|связ/i, textPattern: /contact|iletişim|iletisim|связ|get\s+in\s+touch|bize\s+ulaş/i },
    { field: "visit_url", urlPattern: /visit|tour|campus.?visit|ziyaret|tur/i, textPattern: /visit|tour|campus\s+tour|ziyaret|kampüs\s+tur|kampus\s+tur|open\s+day/i },
    { field: "online_form_url", urlPattern: /form|online.?form|başvuru.?form|basvuru.?form/i, textPattern: /online\s+form|başvuru\s+form|basvuru\s+form|application\s+form|form\s+doldur/i },
  ];
  
  const found = new Set<string>();
  
  for (const { field, urlPattern, textPattern } of ctaPatterns) {
    // Search by URL pattern
    for (const link of links) {
      if (found.has(field)) break;
      if (urlPattern.test(link.url) || textPattern.test(link.text)) {
        facts.push({
          fact_group: "cta_links", field_name: field,
          value_raw: link.url,
          evidence_snippet: `Link text: "${link.text}" → ${link.url}`,
          confidence: 0.8,
        });
        found.add(field);
        break;
      }
    }
  }

  // Also look for button elements with CTA text
  const buttonMatches = [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/gi)];
  for (const bm of buttonMatches) {
    const btnText = bm[1].replace(/<[^>]*>/g, "").trim();
    if (/apply|başvur|basvur|kayıt|kayit|register|enroll/i.test(btnText) && !found.has("apply_button")) {
      // Check if button is inside a form with action
      const formMatch = html.match(/<form[^>]+action="([^"]+)"[^>]*>[\s\S]*?<button/i);
      facts.push({
        fact_group: "cta_links", field_name: "apply_button",
        value_raw: formMatch ? new URL(formMatch[1], pageUrl).href : `button: ${btnText}`,
        evidence_snippet: `Button text: "${btnText}"`,
        confidence: formMatch ? 0.8 : 0.6,
      });
      found.add("apply_button");
    }
  }

  // Check for online application system links (common patterns)
  const appSystemPatterns = [
    /href="([^"]*(?:obs|ubs|ebys|ois|yoksis|osym|ösym)[^"]*)"/gi,
    /href="([^"]*(?:student.?portal|öğrenci.?bilgi|ogrenci.?bilgi|e-kampüs|e-kampus)[^"]*)"/gi,
  ];
  for (const pattern of appSystemPatterns) {
    const match = html.match(pattern);
    if (match && !found.has("student_portal_url")) {
      try {
        const url = new URL(match[1], pageUrl).href;
        facts.push({
          fact_group: "cta_links", field_name: "student_portal_url",
          value_raw: url,
          evidence_snippet: `Student system link: ${url}`,
          confidence: 0.7,
        });
        found.add("student_portal_url");
      } catch { /* skip */ }
    }
  }
}

// ─── Completeness scoring ───
const SECTION_WEIGHTS: Record<FactGroup, number> = {
  identity: 15, contact_location: 10, admissions: 12, deadlines_intakes: 8,
  tuition_fees: 12, scholarships: 8, language_requirements: 8, programs: 12,
  housing: 5, student_life: 3, media_brochures: 3, cta_links: 4,
};

function computeCompleteness(factsByGroup: Record<string, number>): { overall: number; by_section: Record<string, { score: number; weight: number; found: boolean }> } {
  let totalWeight = 0;
  let earnedWeight = 0;
  const bySection: Record<string, { score: number; weight: number; found: boolean }> = {};

  for (const [group, weight] of Object.entries(SECTION_WEIGHTS)) {
    const found = (factsByGroup[group] || 0) > 0;
    totalWeight += weight;
    if (found) earnedWeight += weight;
    bySection[group] = { score: found ? 100 : 0, weight, found };
  }

  return { overall: totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0, by_section: bySection };
}

// ─── Program Scope Detection ───
interface KnownProgram {
  id: string;
  title: string;
  degree_level: string | null;
  slug_tokens: string[];
  degree_codes: string[];
}

const DEGREE_SYNONYMS: Record<string, string> = {
  bsc: "bsc", bachelor: "bsc", ba: "ba",
  msc: "msc", master: "msc", ma: "ma",
  meng: "meng", beng: "beng",
  phd: "phd", doctorate: "phd",
  llb: "llb", llm: "llm", mba: "mba",
  mbbs: "mbbs", mbchb: "mbbs", med: "med", bmed: "bmed",
  bds: "bds", bpharm: "bpharm", mpharm: "mpharm",
  mres: "mres", pgdip: "pgdip",
};
const DEGREE_TOKENS = new Set(Object.keys(DEGREE_SYNONYMS).concat(["hons"]));

const ADMISSIONS_SUBPAGE_SEGMENT_PATTERNS = [
  /^entry-requirements?$/i,
  /^how-to-apply$/i,
  /^apply$/i,
  /^admissions?$/i,
  /^requirements?$/i,
  /^application-requirements?$/i,
  /^entry$/i,
];

const NON_PROGRAM_PATH_TOKENS = new Set([
  "undergraduate", "postgraduate", "ug", "pg", "courses", "course",
  "program", "programme", "programmes", "programs", "study", "international",
  "entry", "requirements", "requirement", "admissions", "admission", "apply",
  "application", "how", "to", "for", "and", "the", "with",
]);

function uniqueTokens(tokens: string[]): string[] {
  return [...new Set(tokens.filter(Boolean))];
}

function extractDegreeCodes(text: string): string[] {
  return uniqueTokens(
    text.toLowerCase().replace(/[^a-z0-9\s()-]/g, " ").split(/[\s()-]+/)
      .filter(t => DEGREE_TOKENS.has(t)).map(t => DEGREE_SYNONYMS[t] || t)
  );
}

function degreesCompatible(observed: string[], target: string[]): boolean {
  const obs = new Set(observed.filter(d => d !== "hons"));
  const tgt = new Set(target.filter(d => d !== "hons"));
  if (obs.size === 0 || tgt.size === 0) return true;
  return [...obs].some(d => tgt.has(d));
}

async function loadKnownPrograms(db: ReturnType<typeof supaAdmin>, universityId: string): Promise<KnownProgram[]> {
  const { data } = await db.from("programs").select("id, title, degree_level")
    .eq("university_id", universityId).limit(500);
  if (!data || data.length === 0) return [];
  return data.map((p: any) => ({
    id: p.id,
    title: p.title,
    degree_level: p.degree_level,
    slug_tokens: uniqueTokens(slugifyTitle(p.title)),
    degree_codes: extractDegreeCodes(p.title),
  }));
}

function slugifyTitle(title: string): string[] {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").split(/[\s-]+/)
    .filter(t => t.length > 2 && !DEGREE_TOKENS.has(t) && !["the","and","for","with"].includes(t));
}

const PROGRAM_URL_PATTERNS = [
  /\/courses\/[^/]+-(?:bsc|msc|phd|ba|ma|meng|beng|llb|llm|mbbs|mbchb|mba|med|bmed|bds|bpharm|mpharm|mres|pgdip)/i,
  /\/(?:course|programme|program)s?\/\d{4}\/[^/]+/i,
  /\/(?:course|programme|program)s?\/(?:undergraduate|postgraduate|ug|pg)\/[^/]{8,}/i,
];

function matchProgramFromUrl(url: string, programs: KnownProgram[]): KnownProgram | null {
  if (programs.length === 0) return null;
  const urlLower = url.toLowerCase();
  if (!PROGRAM_URL_PATTERNS.some(p => p.test(urlLower))) return null;

  const pathParts = new URL(url).pathname.toLowerCase().split("/").filter(Boolean);
  const slugSegment = pathParts[pathParts.length - 1] || "";
  const allUrlTokens = slugSegment.replace(/[^a-z0-9-]/g, "").split("-").filter(t => t.length > 0);
  const urlDegrees = allUrlTokens.filter(t => DEGREE_TOKENS.has(t)).map(t => DEGREE_SYNONYMS[t] || t);
  const urlContentTokens = uniqueTokens(allUrlTokens.filter(t => t.length > 2 && !DEGREE_TOKENS.has(t)));
  if (urlContentTokens.length < 2) return null;

  let bestMatch: KnownProgram | null = null;
  let bestScore = 0;

  for (const prog of programs) {
    if (prog.slug_tokens.length === 0) continue;
    const overlap = prog.slug_tokens.filter(t => urlContentTokens.includes(t)).length;
    const contentScore = overlap / Math.max(prog.slug_tokens.length, 1);
    if (contentScore < 0.5 || overlap < 2) continue;
    if (!degreesCompatible(urlDegrees, prog.degree_codes)) continue;

    const degreeBonus = (urlDegrees.length > 0 && prog.degree_codes.length > 0) ? 0.3 : 0;
    const totalScore = contentScore + degreeBonus;
    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestMatch = prog;
    }
  }

  return bestMatch;
}

function matchProgramFromAdmissionsSubpage(url: string, pageTitle: string, programs: KnownProgram[]): KnownProgram | null {
  if (programs.length === 0) return null;

  const pathname = new URL(url).pathname.toLowerCase();
  const segments = pathname.split("/").filter(Boolean);
  const hasAdmissionsSubpage = segments.some(seg =>
    ADMISSIONS_SUBPAGE_SEGMENT_PATTERNS.some(p => p.test(seg)) || NON_PROGRAM_PATH_TOKENS.has(seg)
  );

  if (!hasAdmissionsSubpage) return null;

  const pathTokens = uniqueTokens(
    segments
      .flatMap(seg => seg.replace(/[^a-z0-9-]/g, "").split("-"))
      .filter(t => t.length > 2 && !NON_PROGRAM_PATH_TOKENS.has(t) && !DEGREE_TOKENS.has(t) && !/^\d{4}$/.test(t))
  );

  if (pathTokens.length === 0) return null;

  const titleTokens = uniqueTokens(slugifyTitle(pageTitle).filter(t => !NON_PROGRAM_PATH_TOKENS.has(t)));
  const combinedTokens = uniqueTokens([...pathTokens, ...titleTokens]);
  const observedDegrees = extractDegreeCodes(`${segments.join(" ")} ${pageTitle}`);

  let bestMatch: KnownProgram | null = null;
  let bestScore = 0;
  let secondBest = 0;

  for (const prog of programs) {
    const progTokens = uniqueTokens(prog.slug_tokens);
    if (progTokens.length === 0) continue;

    const overlap = progTokens.filter(t => combinedTokens.includes(t)).length;
    const pathOverlap = progTokens.filter(t => pathTokens.includes(t)).length;
    if (overlap === 0 || pathOverlap === 0) continue;
    if (!degreesCompatible(observedDegrees, prog.degree_codes)) continue;

    const coverage = overlap / progTokens.length;
    const pathCoverage = pathOverlap / progTokens.length;
    const degreeBonus = (observedDegrees.length > 0 && prog.degree_codes.length > 0) ? 0.2 : 0;
    const score = coverage + (pathCoverage * 0.25) + degreeBonus;

    if (score > bestScore) {
      secondBest = bestScore;
      bestScore = score;
      bestMatch = prog;
    } else if (score > secondBest) {
      secondBest = score;
    }
  }

  if (!bestMatch) return null;
  if (bestScore < 1.0) return null;
  if (bestScore - secondBest < 0.2) return null;

  return bestMatch;
}

function matchProgramFromContent(pageTitle: string, programs: KnownProgram[]): KnownProgram | null {
  if (programs.length === 0 || !pageTitle) return null;
  const titleLower = pageTitle.toLowerCase();
  const titleDegrees = extractDegreeCodes(titleLower);
  if (titleDegrees.length === 0) return null;

  for (const prog of programs) {
    const progLower = prog.title.toLowerCase();
    const titleClean = titleLower.replace(/\s*[-|–]\s*.+$/, "").trim();
    if ((titleClean.includes(progLower) || progLower.includes(titleClean)) && degreesCompatible(titleDegrees, prog.degree_codes)) {
      return prog;
    }

    const titleTokens = uniqueTokens(slugifyTitle(titleLower));
    const overlap = prog.slug_tokens.filter(t => titleTokens.includes(t)).length;
    if (overlap >= 2 && overlap / Math.max(prog.slug_tokens.length, 1) >= 0.5) {
      if (!degreesCompatible(titleDegrees, prog.degree_codes)) continue;
      return prog;
    }
  }

  return null;
}

function matchProgramFromHint(hint: string, programs: KnownProgram[]): KnownProgram | null {
  if (!hint || programs.length === 0) return null;
  const hintTokens = uniqueTokens(slugifyTitle(hint));
  if (hintTokens.length === 0) return null;

  let best: KnownProgram | null = null;
  let bestScore = 0;
  let second = 0;

  for (const prog of programs) {
    const overlap = prog.slug_tokens.filter(t => hintTokens.includes(t)).length;
    if (overlap === 0) continue;
    const score = overlap / Math.max(prog.slug_tokens.length, hintTokens.length);
    if (score > bestScore) {
      second = bestScore;
      bestScore = score;
      best = prog;
    } else if (score > second) {
      second = score;
    }
  }

  if (!best) return null;
  if (bestScore < 0.4) return null;
  if (bestScore - second < 0.08) return null;
  return best;
}

// ─── Main crawl logic for one university ───
async function crawlUniversity(
  db: ReturnType<typeof supaAdmin>,
  row: any,
  traceId: string,
  maxPages: number,
  targetUrls?: string[],
): Promise<void> {
  const { id: rowId, university_id, website, university_name } = row;
  const officialDomain = getOfficialDomain(website);

  if (!officialDomain) {
    await db.from("official_site_crawl_rows").update({
      crawl_status: "special", reason_codes: ["INVALID_DOMAIN"],
      error_message: `Domain rejected: ${website}`, updated_at: new Date().toISOString(),
    }).eq("id", rowId);
    await db.from("official_site_special_queue").upsert({
      university_id, university_name, website,
      reason_code: "INVALID_DOMAIN", strategy_needed: "manual_review",
    }, { onConflict: "university_id" });
    return;
  }

  const startTime = Date.now();
  const normalizedUrl = website.startsWith("http") ? website : `https://${website}`;

  await db.from("official_site_crawl_rows").update({
    crawl_status: "fetching", locked_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq("id", rowId);

  try {
    // ── Load known programs for program-scoping ──
    const knownPrograms = await loadKnownPrograms(db, university_id);
    console.log(`[OSC-Worker] ${university_name}: ${knownPrograms.length} known programs loaded for scoping`);

    // ── Discovery: targeted URLs or multi-pass ──
    let pagesToScrape: Array<{ url: string; factGroups: FactGroup[] }>;
    let homepageHtml = "";

    let discoveryPassResults: any[] = [];

    if (targetUrls && targetUrls.length > 0) {
      // Targeted injection: skip discovery, use provided URLs directly
      console.log(`[OSC-Worker] ${university_name}: TARGETED mode — ${targetUrls.length} injected URLs`);
      pagesToScrape = targetUrls.map(u => ({ url: u, factGroups: [...FACT_GROUPS] }));
      discoveryPassResults = [{ method: "targeted_injection", urls: targetUrls.length }];
    } else {
      // Normal multi-pass discovery
      const discovery = await discoverOfficialPages(normalizedUrl, officialDomain, maxPages, startTime);
      pagesToScrape = discovery.pages;
      homepageHtml = discovery.homepageHtml;
      discoveryPassResults = discovery.passResults;
      console.log(`[OSC-Worker] ${university_name}: ${pagesToScrape.length} pages from ${discoveryPassResults.length} passes`);
    }

    await db.from("official_site_crawl_rows").update({
      crawl_status: "extracting", updated_at: new Date().toISOString(),
    }).eq("id", rowId);

    // ── Fetch and extract (FREE/LOCAL) ──
    const observations: any[] = [];
    let pagesScraped = 0;
    let antiBotPages = 0;
    let jsOnlyPages = 0;
    const factsByGroup: Record<string, number> = {};
    const fetchedAt = new Date().toISOString();

    // Extract from homepage HTML first (already fetched during discovery)
    if (homepageHtml.length > 200) {
      const cls = classifyPage(htmlToText(homepageHtml), homepageHtml);
      if (cls.type === "ok") {
        const homeMd = htmlToText(homepageHtml);
        const homeTitle = extractTitle(homepageHtml);
        // Homepage gets all fact groups for broad extraction
        const homeFacts = extractFacts(homeMd, homepageHtml, normalizedUrl, [...FACT_GROUPS]);
        for (const fact of homeFacts) {
          factsByGroup[fact.fact_group] = (factsByGroup[fact.fact_group] || 0) + 1;
          observations.push({
            job_id: row.job_id, row_id: rowId, university_id,
            field_name: fact.field_name, fact_group: fact.fact_group,
            value_raw: fact.value_raw.slice(0, 5000),
            evidence_snippet: fact.evidence_snippet.slice(0, 500),
            source_url: normalizedUrl, page_title: homeTitle || null,
            source_type: "official_website", confidence: fact.confidence,
            trace_id: traceId, entity_type: "university", status: "new",
            fetched_at: fetchedAt, extracted_at: fetchedAt, parser_version: PARSER_VERSION,
          });
        }
        pagesScraped++;
      }
    }

    // Fetch and extract remaining pages
    for (const page of pagesToScrape) {
      if (page.url === normalizedUrl) continue; // already processed homepage
      if (Date.now() - startTime > TIME_BUDGET_MS) break;

      try {
        const parsed = await fetchWithFallback(page.url, officialDomain);
        pagesScraped++;

        if (parsed.classification.type === "hard_block" || parsed.classification.type === "cloudflare") {
          antiBotPages++;
          continue;
        }
        if (parsed.classification.type === "js_only") {
          jsOnlyPages++;
          // Still try to extract what we can from the minimal HTML
          if (parsed.markdown.length < 100) continue;
        }
        if (parsed.classification.type === "empty") continue;

        const facts = extractFacts(parsed.markdown, parsed.html, page.url, page.factGroups);

        // ── Program scope detection ──
        const urlMatch = matchProgramFromUrl(page.url, knownPrograms);
        const titleMatch = !urlMatch ? matchProgramFromContent(parsed.title || "", knownPrograms) : null;
        const subpageMatch = !urlMatch && !titleMatch
          ? matchProgramFromAdmissionsSubpage(page.url, parsed.title || "", knownPrograms)
          : null;
        const matchedProgram = urlMatch || titleMatch || subpageMatch;
        const scopedEntityType = matchedProgram ? "program" : "university";
        const scopedEntityId = matchedProgram ? matchedProgram.id : null;

        if (matchedProgram) {
          const matchSource = urlMatch ? "URL" : titleMatch ? "title" : "admissions_subpage";
          console.log(`[OSC-Worker] 🎯 Program match: "${matchedProgram.title}" (${matchedProgram.id}) from ${matchSource} — ${page.url}`);
        }

        for (const fact of facts) {
          factsByGroup[fact.fact_group] = (factsByGroup[fact.fact_group] || 0) + 1;

          const hintProgram = fact.program_hint ? matchProgramFromHint(fact.program_hint, knownPrograms) : null;
          const effectiveEntityId = hintProgram?.id || scopedEntityId;
          const effectiveEntityType = effectiveEntityId ? "program" : scopedEntityType;

          observations.push({
            job_id: row.job_id, row_id: rowId, university_id,
            entity_id: effectiveEntityId,
            field_name: fact.field_name, fact_group: fact.fact_group,
            value_raw: fact.value_raw.slice(0, 5000),
            evidence_snippet: fact.evidence_snippet.slice(0, 500),
            source_url: page.url, page_title: parsed.title || null,
            source_type: "official_website", confidence: fact.confidence,
            trace_id: traceId, entity_type: effectiveEntityType, status: "new",
            fetched_at: fetchedAt, extracted_at: fetchedAt, parser_version: PARSER_VERSION,
          });
        }
      } catch (fetchErr: any) {
        console.warn(`[OSC-Worker] Fetch failed: ${page.url}: ${fetchErr.message}`);
      }
    }

    // ── Save observations in bulk ──
    if (observations.length > 0) {
      const CHUNK = 50;
      for (let i = 0; i < observations.length; i += CHUNK) {
        await db.from("official_site_observations").insert(observations.slice(i, i + CHUNK));
      }
    }

    // ── Phase B: File Artifact Discovery & Registration ──
    // Discover PDF/doc links from observations and register them as artifacts
    const fileArtifacts: any[] = [];
    const ARTIFACT_TYPE_PATTERNS: Array<{ type: string; pattern: RegExp }> = [
      { type: "brochure", pattern: /brochure|prospectus|tanıtım|tanitim|buklet|брошюра/i },
      { type: "fee_sheet", pattern: /fee|tuition|ücret|ucret|harç|harc|стоимость|pricing/i },
      { type: "application_form", pattern: /application|apply|başvuru|basvuru|заявлен/i },
      { type: "guide", pattern: /guide|handbook|manual|kılavuz|kilavuz|руководство/i },
      { type: "prospectus", pattern: /prospectus|catalog|catalogue|katalog/i },
    ];

    function classifyArtifactType(url: string, pageTitle: string): string {
      const combined = `${url} ${pageTitle}`.toLowerCase();
      for (const { type, pattern } of ARTIFACT_TYPE_PATTERNS) {
        if (pattern.test(combined)) return type;
      }
      return "unknown";
    }

    // Collect file URLs from brochure_links and document_links observations
    for (const obs of observations) {
      if (obs.field_name === "brochure_links" || obs.field_name === "document_links") {
        try {
          const urls: string[] = JSON.parse(obs.value_raw);
          for (const fileUrl of urls.slice(0, 5)) {
            if (!isWithinDomain(fileUrl, officialDomain)) continue;
            const fileName = fileUrl.split("/").pop()?.split("?")[0] || "unknown";
            const mimeType = fileName.endsWith(".pdf") ? "application/pdf"
              : fileName.endsWith(".docx") ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              : fileName.endsWith(".xlsx") ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              : "application/octet-stream";
            
            fileArtifacts.push({
              university_id,
              program_id: obs.entity_id || null,
              job_id: row.job_id,
              row_id: rowId,
              trace_id: traceId,
              source_url: fileUrl,
              source_page_url: obs.source_url,
              source_page_title: obs.page_title,
              file_name: decodeURIComponent(fileName).slice(0, 200),
              mime_type: mimeType,
              artifact_type: classifyArtifactType(fileUrl, obs.page_title || ""),
              parse_status: "pending",
              parser_version: PARSER_VERSION,
              fetched_at: fetchedAt,
            });
          }
        } catch { /* not valid JSON */ }
      }
    }

    // Save file artifacts
    if (fileArtifacts.length > 0) {
      await db.from("crawl_file_artifacts").insert(fileArtifacts);
      console.log(`[OSC-Worker] 📎 ${university_name}: ${fileArtifacts.length} file artifacts registered`);
    }

    // ── Compute completeness ──
    const completeness = computeCompleteness(factsByGroup);
    const missingSections = FACT_GROUPS.filter(g => !factsByGroup[g]);

    // ── Determine status (improved classification) ──
    const reasonCodes: string[] = [];
    if (Object.keys(factsByGroup).length === 0) reasonCodes.push("NO_DATA_EXTRACTED");
    if (!factsByGroup["identity"]) reasonCodes.push("MISSING_IDENTITY");
    if (!factsByGroup["tuition_fees"]) reasonCodes.push("MISSING_FEES");
    if (!factsByGroup["programs"]) reasonCodes.push("MISSING_PROGRAMS");
    if (!factsByGroup["admissions"]) reasonCodes.push("MISSING_ADMISSIONS");
    if (pagesScraped === 0) reasonCodes.push("ALL_PAGES_FAILED");
    if (antiBotPages > 0) reasonCodes.push("ANTI_BOT_PAGE");
    if (jsOnlyPages > 0) reasonCodes.push("JS_ONLY_PAGE");

    // Only quarantine if truly blocked, not just missing some data
    const totalUsablePages = pagesScraped - antiBotPages;
    const needsSpecial = pagesScraped === 0 || Object.keys(factsByGroup).length === 0 || (antiBotPages === pagesScraped && pagesScraped > 0);
    const mappedStatus = needsSpecial ? "special" : "verifying";

    await db.from("official_site_crawl_rows").update({
      crawl_status: mappedStatus,
      completeness_score: completeness.overall,
      completeness_by_section: completeness.by_section,
      pages_scraped: pagesScraped,
      pages_mapped: pagesToScrape.length,
      discovery_passes: discoveryPassResults,
      coverage_result: {
        facts_by_group: factsByGroup,
        missing_sections: missingSections,
        anti_bot_pages: antiBotPages,
        js_only_pages: jsOnlyPages,
        usable_pages: totalUsablePages,
        elapsed_ms: Date.now() - startTime,
        acquisition: "local_only",
      },
      reason_codes: reasonCodes.length > 0 ? reasonCodes : null,
      updated_at: new Date().toISOString(),
    }).eq("id", rowId);

    if (needsSpecial) {
      const strategy = antiBotPages === pagesScraped ? "all_blocked" : (pagesScraped === 0 ? "fetch_failed" : "manual_review");
      await db.from("official_site_special_queue").upsert({
        university_id, university_name, website,
        reason_code: reasonCodes[0] || "EXTRACTION_FAILED",
        strategy_needed: strategy,
      }, { onConflict: "university_id" });
    }

    console.log(`[OSC-Worker] ✅ ${university_name}: ${pagesScraped} pages (${antiBotPages} blocked, ${jsOnlyPages} js-only), ${observations.length} facts, completeness=${completeness.overall}%`);

  } catch (err: any) {
    console.error(`[OSC-Worker] ❌ ${university_name}: ${err.message}`);
    await db.from("official_site_crawl_rows").update({
      crawl_status: "failed", error_message: err.message?.slice(0, 500),
      reason_codes: ["CRAWL_ERROR"], updated_at: new Date().toISOString(),
    }).eq("id", rowId);
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
    if (token === SERVICE_ROLE_KEY) {
      authorized = true;
    } else {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload.role === "service_role") authorized = true;
      } catch { /* not a JWT */ }
    }
    if (!authorized) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    const body = await req.json();
    const { job_id, worker_id = "w1", batch_size: reqBatchSize, target_urls } = body;
    if (!job_id) throw new Error("job_id required");

    const db = supaAdmin();
    const traceId = `OSC-W-${Date.now()}`;

    const { data: job } = await db
      .from("official_site_crawl_jobs")
      .select("id, status, kill_switch, max_pages_per_uni, source_policy")
      .eq("id", job_id).single();

    if (!job || job.status !== "crawling" || job.kill_switch) {
      return new Response(JSON.stringify({ skipped: true, reason: "job not active" }), { headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    if (job.source_policy && job.source_policy !== "official_only") {
      return new Response(JSON.stringify({ error: "Only official_only source policy is allowed" }), { status: 403, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    const maxPages = job.max_pages_per_uni || DEFAULT_MAX_PAGES;

    const { data: rows, error: claimErr } = await db.rpc("rpc_osc_claim_rows", {
      p_job_id: job_id, p_worker_id: worker_id, p_batch_size: reqBatchSize || BATCH_SIZE,
    });

    if (claimErr) {
      return new Response(JSON.stringify({ error: "Row claim failed: " + claimErr.message }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ done: true, message: "No more queued rows" }), { headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    const results = await Promise.all(
      rows.map(async (row: any) => {
        try {
          // Merge body-level target_urls with per-row coverage_plan.seed_urls
          let effectiveSeeds = target_urls || [];
          if (row.coverage_plan?.seed_urls?.length) {
            const planSeeds: string[] = row.coverage_plan.seed_urls;
            effectiveSeeds = [...new Set([...effectiveSeeds, ...planSeeds])];
          }
          await crawlUniversity(db, row, traceId, maxPages, effectiveSeeds.length > 0 ? effectiveSeeds : undefined);
          return { university: row.university_name, id: row.university_id, ok: true, seeds_used: effectiveSeeds.length };
        } catch (e: any) {
          return { university: row.university_name, id: row.university_id, ok: false, error: e.message };
        }
      })
    );

    return new Response(JSON.stringify({
      ok: true, trace_id: traceId, parser_version: PARSER_VERSION,
      source_policy: "official_only", acquisition: "local_only",
      processed: results.length, universities: results,
    }), { headers: { ...corsHeaders, "content-type": "application/json" } });

  } catch (err: any) {
    console.error("[OSC-Worker] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
  }
});
