// Comprehensive extraction utilities for country-agnostic harvest

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

export const UA = "LavistaHarvester/1.0 (+https://connectstudyworld.com)";
const FETCH_TIMEOUT_MS = 12000;

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Extract eTLD+1 (simplified)
 */
export function eTLD1(u: string): string {
  try {
    const { hostname } = new URL(u);
    const h = hostname.replace(/^www\./i, '').split('.');
    // Simple heuristic: last 2 parts
    return h.slice(-2).join('.');
  } catch {
    return u;
  }
}

export const sameSite = (a: string, b: string) => eTLD1(a) === eTLD1(b);

/**
 * Fetch text with timeout
 */
export async function fetchText(url: string): Promise<string> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: ctl.signal
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

/**
 * Render dynamic page with Firecrawl (optional)
 */
export async function renderText(url: string): Promise<string | null> {
  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key) return null;
  
  try {
    const r = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        javascript: true,
        waitFor: 2000
      })
    });
    
    if (!r.ok) return null;
    const j = await r.json();
    return j?.markdown ?? null;
  } catch {
    return null;
  }
}

/**
 * Make URL absolute
 */
export function absolute(base: string, href: string): string {
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

/**
 * Collect anchor links from HTML
 */
export function collectAnchors(html: string, base: string): string[] {
  const out: string[] = [];
  const regex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
  
  for (const m of html.matchAll(regex)) {
    out.push(absolute(base, m[1]));
  }
  
  return [...new Set(out)];
}

/**
 * Parse sitemap XML
 */
export function parseSitemap(xml: string, base: string): string[] {
  const out: string[] = [];
  const regex = /<loc>([^<]+)<\/loc>/gi;
  
  for (const m of xml.matchAll(regex)) {
    out.push(absolute(base, m[1].trim()));
  }
  
  return out;
}

/**
 * Collect links from sitemap and anchor tags
 */
export async function collectLinksFromSitemapAndAnchors(home: string): Promise<string[]> {
  const out: Set<string> = new Set();
  const baseUrl = home.replace(/\/$/, '');
  
  // Try sitemaps
  for (const path of ["/sitemap.xml", "/sitemap_index.xml"]) {
    try {
      const xml = await fetchText(baseUrl + path);
      parseSitemap(xml, home).forEach(u => out.add(u));
    } catch {
      // Sitemap not found, continue
    }
  }
  
  // Try home page anchors
  try {
    const html = await fetchText(home);
    collectAnchors(html, home).forEach(u => out.add(u));
  } catch {
    // Failed to fetch home
  }
  
  return [...out];
}

/**
 * Check if text has currency and numbers
 */
export function hasCurrencyOrNumbers(text: string, currency: string): boolean {
  const currencyMap: Record<string, string> = {
    USD: "\\$|USD",
    GBP: "£|GBP",
    EUR: "€|EUR",
    CAD: "\\$|CAD|C\\$",
    AUD: "\\$|AUD|A\\$",
    TRY: "₺|TRY",
    RUB: "₽|RUB|руб",
    SAR: "﷼|SAR|ر\\.س|ريال",
    AED: "د\\.إ|AED|درهم",
    EGP: "ج\\.م|EGP|جنيه",
    INR: "₹|INR"
  };
  
  const cr = new RegExp(currencyMap[currency] || currency, "i");
  const hasCur = cr.test(text);
  const hasNum = /\d{3,}/.test(text);
  
  return hasNum && hasCur;
}

/**
 * Parse academic year from text
 */
export function parseAcademicYear(text: string): string | null {
  const m = text.match(/(20\d{2})\s*[\/\-]\s*(20\d{2})/);
  return m ? `${m[1]}/${m[2]}` : null;
}

/**
 * Check if page has numbers and currency (with optional render)
 */
export async function pageHasNumbersCurrency(
  url: string,
  currency: string,
  opts: { renderIfTiny?: boolean } = {}
): Promise<boolean> {
  try {
    let txt = await fetchText(url);
    
    // Render if content is too small (might be dynamic)
    if (opts.renderIfTiny && txt.length < 2000) {
      const rendered = await renderText(url);
      if (rendered) txt = rendered;
    }
    
    return hasCurrencyOrNumbers(txt, currency);
  } catch {
    return false;
  }
}

/**
 * Check if page mentions admission terms (with optional render)
 */
export async function pageMentionsAdmission(
  url: string,
  matchers: { adm: RegExp },
  opts: { renderIfTiny?: boolean } = {}
): Promise<boolean> {
  try {
    let txt = await fetchText(url);
    
    // Render if content is too small
    if (opts.renderIfTiny && txt.length < 2000) {
      const rendered = await renderText(url);
      if (rendered) txt = rendered;
    }
    
    return matchers.adm.test(txt);
  } catch {
    return false;
  }
}

/**
 * Build regex matchers from terms
 */
export function buildMatchers(terms: {
  fee_terms: string[];
  admission_terms: string[];
  scholarship_terms?: string[];
}) {
  const re = (arr: string[]) => {
    if (arr.length === 0) return /$a/; // Never match
    const escaped = arr.map(s => s.trim().replace(/\s+/g, "\\s+"));
    return new RegExp(escaped.join("|"), "i");
  };
  
  return {
    fee: re(terms.fee_terms),
    adm: re(terms.admission_terms),
    schl: re(terms.scholarship_terms || [])
  };
}
