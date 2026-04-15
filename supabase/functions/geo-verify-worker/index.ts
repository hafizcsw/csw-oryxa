/**
 * Geo Verification Worker v4
 * 
 * CHANGES from v3:
 * - Cascading fallback geocoding: full_address → city_country → name_city_country → name_country (patch E)
 * - Footer parsing cleanup: reject broken fragments, validate minimum quality (patch F)
 * - All previous patches (A-D) preserved
 */
import { getSupabaseAdmin } from '../_shared/supabase.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_PAGES = 7;
const MAX_BODY = 500_000;
const FETCH_TIMEOUT = 10_000;
const GEOCODE_TIMEOUT = 8_000;

// --- Geo signal extraction ---

interface GeoSignal {
  source_type: string;
  source_url: string;
  entity_type: string;
  entity_scope: string | null;
  detected_country_code: string | null;
  detected_city: string | null;
  detected_address: string | null;
  detected_lat: number | null;
  detected_lon: number | null;
  confidence: number;
  signals: Record<string, any>;
  raw_excerpt: string | null;
}

const TLD_COUNTRY: Record<string, string> = {
  'uk': 'GB', 'co.uk': 'GB', 'ac.uk': 'GB',
  'de': 'DE', 'fr': 'FR', 'es': 'ES', 'it': 'IT',
  'nl': 'NL', 'be': 'BE', 'at': 'AT', 'ch': 'CH',
  'se': 'SE', 'no': 'NO', 'dk': 'DK', 'fi': 'FI',
  'pl': 'PL', 'cz': 'CZ', 'pt': 'PT', 'gr': 'GR',
  'ie': 'IE', 'hu': 'HU', 'ro': 'RO', 'bg': 'BG',
  'hr': 'HR', 'sk': 'SK', 'si': 'SI', 'lt': 'LT',
  'lv': 'LV', 'ee': 'EE',
  'ru': 'RU', 'ua': 'UA', 'by': 'BY', 'kz': 'KZ',
  'tr': 'TR', 'sa': 'SA', 'ae': 'AE', 'eg': 'EG',
  'ma': 'MA', 'tn': 'TN', 'jo': 'JO', 'lb': 'LB',
  'iq': 'IQ', 'kw': 'KW', 'qa': 'QA', 'bh': 'BH', 'om': 'OM',
  'in': 'IN', 'cn': 'CN', 'jp': 'JP', 'kr': 'KR',
  'my': 'MY', 'sg': 'SG', 'th': 'TH', 'id': 'ID',
  'ph': 'PH', 'vn': 'VN', 'pk': 'PK', 'bd': 'BD',
  'au': 'AU', 'nz': 'NZ',
  'ca': 'CA', 'mx': 'MX', 'br': 'BR', 'ar': 'AR',
  'cl': 'CL', 'co': 'CO', 'pe': 'PE',
  'za': 'ZA', 'ng': 'NG', 'ke': 'KE', 'gh': 'GH',
  'edu': 'US',
};

function getTldCountry(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    for (const [tld, code] of Object.entries(TLD_COUNTRY)) {
      if (host.endsWith(`.${tld}`)) return code;
    }
    return null;
  } catch { return null; }
}

// ============================================================
// PATCH C: City validation — reject street fragments
// ============================================================

function isValidCity(city: string | null | undefined): boolean {
  if (!city || city.trim().length < 2) return false;
  const c = city.trim();
  // Reject if contains digits (street numbers, postal codes)
  if (/\d/.test(c)) return false;
  // Reject if contains street-like words
  const streetWords = /\b(street|str\.|road|rd\.|avenue|ave\.|blvd|boulevard|lane|drive|plaza|pl\.|building|floor|suite|apt|block|p\.?\s*o\.?\s*box)\b/i;
  if (streetWords.test(c)) return false;
  // Reject if too long (likely an address fragment)
  if (c.length > 50) return false;
  // Reject if looks like "City - Country" pattern
  if (c.includes(' - ') && c.split(' - ').length === 2) {
    // Extract just the city part
    return false; // caller should use cleanCity instead
  }
  return true;
}

function cleanCity(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let c = raw.trim();
  // Remove "City - Country" pattern → keep city only
  if (c.includes(' - ')) {
    c = c.split(' - ')[0].trim();
  }
  // Remove trailing country names
  c = c.replace(/,?\s*(Denmark|Sweden|Norway|Finland|Germany|France|Spain|Italy|Netherlands|Belgium|Austria|Switzerland|UK|United Kingdom|USA|United States|Canada|Australia|Russia|Turkey|Saudi Arabia|UAE|Egypt|India|China|Japan|South Korea|Brazil|Mexico)$/i, '').trim();
  // Remove postal codes
  c = c.replace(/\b\d{4,6}\b/g, '').trim();
  // Remove directional qualifiers like "East", "West" etc. when attached
  // but keep compound city names like "East London"
  
  if (!isValidCity(c)) return null;
  // Capitalize properly
  return c.charAt(0).toUpperCase() + c.slice(1);
}

// ============================================================
// PATCH B: Address normalization before geocoding
// ============================================================

function normalizeAddress(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let addr = raw.trim();
  // Remove HTML artifacts
  addr = addr.replace(/<[^>]+>/g, ' ');
  // Remove excessive whitespace
  addr = addr.replace(/\s+/g, ' ').trim();
  // Remove leading/trailing punctuation
  addr = addr.replace(/^[,;:\-–]+|[,;:\-–]+$/g, '').trim();
  // Remove phone/fax patterns
  addr = addr.replace(/(?:tel|phone|fax|email|e-mail)\s*[:.]?\s*[\d\s\+\-\(\)]+/gi, '').trim();
  // Remove URLs
  addr = addr.replace(/https?:\/\/\S+/gi, '').trim();
  // Remove page title noise (text before first comma if it looks like a title)
  if (addr.length > 100) {
    // Truncate to first meaningful chunk (first 3 comma-separated parts)
    const parts = addr.split(',').slice(0, 4);
    addr = parts.join(',').trim();
  }
  if (addr.length < 5) return null;
  return addr;
}

// ============================================================
// PATCH A: Nominatim geocoding
// ============================================================

interface GeocodeResult {
  lat: number;
  lon: number;
  display_name: string;
  address_city: string | null;
  address_country_code: string | null;
  raw_response: any;
  error: string | null;
}

async function geocodeAddress(
  address: string,
  countryHint: string | null,
  tlog: (stage: string, status: string, extra?: Record<string, any>) => void,
): Promise<GeocodeResult | null> {
  const normalized = normalizeAddress(address);
  if (!normalized) {
    tlog('geocode', 'skip', { reason: 'address_empty_after_normalize', original: address?.slice(0, 100) });
    return null;
  }

  const params = new URLSearchParams({
    q: normalized,
    format: 'json',
    limit: '1',
    addressdetails: '1',
  });
  if (countryHint) {
    params.set('countrycodes', countryHint.toLowerCase());
  }

  const url = `https://nominatim.openstreetmap.org/search?${params}`;
  
  tlog('geocode', 'start', { query: normalized.slice(0, 120), country_hint: countryHint });

  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), GEOCODE_TIMEOUT);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'CSW-GeoVerify/1.0 (university catalog verification)',
        'Accept-Language': 'en',
      },
      signal: ctl.signal,
    });
    clearTimeout(t);

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      tlog('geocode', 'http_error', { status: res.status, body: body.slice(0, 200) });
      return null;
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      tlog('geocode', 'no_results', { query: normalized.slice(0, 120) });
      return { lat: 0, lon: 0, display_name: '', address_city: null, address_country_code: null, raw_response: data, error: 'no_results' };
    }

    const best = data[0];
    const lat = parseFloat(best.lat);
    const lon = parseFloat(best.lon);
    const addrDetail = best.address || {};
    const city = addrDetail.city || addrDetail.town || addrDetail.village || addrDetail.municipality || null;
    const cc = addrDetail.country_code?.toUpperCase() || null;

    tlog('geocode', 'ok', { lat, lon, city, country: cc, display_name: best.display_name?.slice(0, 100) });

    return {
      lat, lon,
      display_name: best.display_name || '',
      address_city: city,
      address_country_code: cc,
      raw_response: { lat: best.lat, lon: best.lon, display_name: best.display_name, address: addrDetail, importance: best.importance },
      error: null,
    };
  } catch (err: any) {
    tlog('geocode', 'error', { error: err.message, query: normalized.slice(0, 80) });
    return null;
  }
}

// ============================================================
// Signal extraction
// ============================================================

function extractJsonLd(html: string): any[] {
  const results: any[] = [];
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(regex)) {
    try {
      const parsed = JSON.parse(m[1]);
      if (Array.isArray(parsed)) results.push(...parsed);
      else results.push(parsed);
    } catch { /* skip malformed */ }
  }
  return results;
}

function geoFromJsonLd(jsonld: any[], sourceUrl: string): GeoSignal[] {
  const signals: GeoSignal[] = [];
  for (const obj of jsonld) {
    const items = obj['@graph'] ? obj['@graph'] : [obj];
    for (const item of items) {
      const addr = item.address || item.location?.address;
      if (addr && typeof addr === 'object') {
        const rawCity = addr.addressLocality || null;
        const city = cleanCity(rawCity);
        signals.push({
          source_type: 'official_site_jsonld', source_url: sourceUrl,
          entity_type: 'university_main', entity_scope: 'main_campus',
          detected_country_code: addr.addressCountry || null,
          detected_city: city,
          detected_address: normalizeAddress(
            [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode, addr.addressCountry].filter(Boolean).join(', ')
          ),
          detected_lat: null, detected_lon: null, confidence: 35,
          signals: { jsonld_found: true, address_found: true, type: item['@type'], raw_city: rawCity },
          raw_excerpt: JSON.stringify(addr).slice(0, 500),
        });
      }
      const geo = item.geo || item.location?.geo;
      if (geo && (geo.latitude || geo.lat)) {
        const lat = parseFloat(geo.latitude || geo.lat);
        const lon = parseFloat(geo.longitude || geo.lng || geo.lon);
        if (!isNaN(lat) && !isNaN(lon)) {
          signals.push({
            source_type: 'official_site_jsonld', source_url: sourceUrl,
            entity_type: 'university_main', entity_scope: 'main_campus',
            detected_country_code: addr?.addressCountry || null,
            detected_city: cleanCity(addr?.addressLocality),
            detected_address: null, detected_lat: lat, detected_lon: lon,
            confidence: 40,
            signals: { jsonld_found: true, geocoordinates_found: true },
            raw_excerpt: JSON.stringify(geo).slice(0, 200),
          });
        }
      }
    }
  }
  return signals;
}

function extractAddressFromText(html: string, sourceUrl: string, sourceType: string): GeoSignal[] {
  const signals: GeoSignal[] = [];
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const addrPatterns = [
    /([A-Z][a-z]+(?:\s[A-Z][a-z]+)*),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/g,
    /(?:address|location|campus|located)\s*[:：]\s*([^,\n]{3,50}),\s*([^,\n]{3,50}),\s*([^,\n]{3,50})/gi,
  ];
  for (const pat of addrPatterns) {
    const m = pat.exec(text);
    if (m) {
      const rawCity = m[1]?.trim() || null;
      const city = cleanCity(rawCity);
      signals.push({
        source_type: sourceType, source_url: sourceUrl,
        entity_type: 'university_main', entity_scope: null,
        detected_country_code: null, detected_city: city,
        detected_address: normalizeAddress(m[0]?.trim()) || null,
        detected_lat: null, detected_lon: null,
        confidence: 20,
        signals: { address_pattern_match: true, page_type: sourceType, raw_city: rawCity },
        raw_excerpt: m[0]?.slice(0, 300) || null,
      });
      break;
    }
  }
  return signals;
}

// ============================================================
// PATCH F: Footer address extraction — reject broken fragments
// ============================================================

function isFooterAddressValid(raw: string): boolean {
  const trimmed = raw.trim();
  // Reject if starts/ends with lowercase fragment (broken token)
  if (/^[a-z]/.test(trimmed)) return false;
  // Reject if starts with 's ' or similar broken prefix
  if (/^[a-z]\s/i.test(trimmed) && trimmed.charAt(0) === trimmed.charAt(0).toLowerCase()) return false;
  // Reject if first word is incomplete (< 2 chars and not a known abbreviation)
  const firstWord = trimmed.split(/[\s,]/)[0];
  if (firstWord.length < 2) return false;
  // Reject if too short overall
  if (trimmed.length < 8) return false;
  // Reject if mostly punctuation/whitespace
  const alphaCount = (trimmed.match(/[a-zA-Z\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF]/g) || []).length;
  if (alphaCount < trimmed.length * 0.3) return false;
  // Reject if ends with broken fragment (single letter or two-letter non-country token)
  const lastToken = trimmed.split(/[\s,]/).filter(Boolean).pop() || '';
  if (lastToken.length === 1) return false;
  return true;
}

function extractFooterAddress(html: string, sourceUrl: string): GeoSignal[] {
  const signals: GeoSignal[] = [];
  const footerMatch = html.match(/<footer[\s\S]*?<\/footer>/i);
  if (!footerMatch) return signals;
  const footerText = footerMatch[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (footerText.length < 10) return signals;
  
  // Look for address-like patterns in footer
  const addrMatch = footerText.match(/([A-Za-z\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\s]+(?:,\s*[A-Za-z\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\s]+){1,3})/);
  if (addrMatch && addrMatch[0].length > 10 && addrMatch[0].length < 150) {
    const raw = addrMatch[0];
    // PATCH F: Validate footer address quality before accepting
    if (!isFooterAddressValid(raw)) {
      return signals; // reject noisy footer fragment
    }
    const normalized = normalizeAddress(raw);
    if (normalized && isFooterAddressValid(normalized)) {
      signals.push({
        source_type: 'official_site_footer', source_url: sourceUrl,
        entity_type: 'university_main', entity_scope: null,
        detected_country_code: null,
        detected_city: null,
        detected_address: normalized,
        detected_lat: null, detected_lon: null,
        confidence: 15,
        signals: { footer_address: true },
        raw_excerpt: footerText.slice(0, 300),
      });
    }
  }
  return signals;
}

function absolute(base: string, href: string): string {
  try { return new URL(href, base).href; } catch { return href; }
}

function sameSite(base: string, target: string): boolean {
  try {
    return new URL(base).hostname === new URL(target).hostname;
  } catch { return false; }
}

function discoverGeoPages(html: string, baseUrl: string): { geo: string[], housing: string[] } {
  const geoKeywords = ['/contact', '/about', '/locations', '/campus', '/visit', '/find-us', '/directions'];
  const housingKeywords = ['/housing', '/accommodation', '/residence', '/dormitor', '/student-life/accommodation', '/living'];
  const geo: Set<string> = new Set();
  const housing: Set<string> = new Set();
  const linkRegex = /<a\s+[^>]*href=["']([^"'#]+)["'][^>]*>/gi;
  for (const m of html.matchAll(linkRegex)) {
    const href = m[1].toLowerCase();
    const fullUrl = absolute(baseUrl, m[1]);
    if (!sameSite(baseUrl, fullUrl)) continue;
    for (const kw of geoKeywords) { if (href.includes(kw)) { geo.add(fullUrl); break; } }
    for (const kw of housingKeywords) { if (href.includes(kw)) { housing.add(fullUrl); break; } }
  }
  return { geo: [...geo].slice(0, 3), housing: [...housing].slice(0, 3) };
}

// ============================================================
// PATCH D: Housing extraction — separate discovery from real location
// ============================================================

function extractHousingSignals(html: string, sourceUrl: string): GeoSignal[] {
  const signals: GeoSignal[] = [];
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 8000);
  
  // Look for actual address/location data, not just page title mentions
  const locationPatterns = [
    // "Address: ..." or "Location: ..."
    /(?:address|location|located at)\s*[:：]\s*([^,\n]{5,80}(?:,\s*[^,\n]{3,40}){1,3})/gi,
  ];
  
  let hasRealLocation = false;
  for (const pat of locationPatterns) {
    const m = pat.exec(text);
    if (m) {
      const addr = normalizeAddress(m[1]);
      if (addr) {
        hasRealLocation = true;
        signals.push({
          source_type: 'official_site_housing', source_url: sourceUrl,
          entity_type: 'dorm', entity_scope: 'housing_location',
          detected_country_code: null, detected_city: null,
          detected_address: addr,
          detected_lat: null, detected_lon: null,
          confidence: 20,
          signals: { housing_location_extracted: true, pattern: 'address_label' },
          raw_excerpt: m[0]?.slice(0, 300) || null,
        });
        break;
      }
    }
  }

  // Price extraction
  const priceMatch = text.match(/[\$£€]\s*([\d,]+(?:\.\d{2})?)\s*(?:per|\/)\s*(?:month|week|semester|year|term)/i)
    || text.match(/([\d,]+(?:\.\d{2})?)\s*(?:SAR|AED|USD|GBP|EUR|RUB|TRY|EGP)\s*(?:per|\/)\s*(?:month|week|semester|year|term)/i);
  
  if (!hasRealLocation) {
    // Only record as "page discovery" — low confidence, no address claim
    signals.push({
      source_type: 'official_site_housing', source_url: sourceUrl,
      entity_type: 'dorm', entity_scope: 'housing_page_only',
      detected_country_code: null, detected_city: null,
      detected_address: null,
      detected_lat: null, detected_lon: null,
      confidence: 5, // very low — page exists but no real data
      signals: { housing_page_discovered: true, has_price: !!priceMatch, price_raw: priceMatch?.[0]?.slice(0, 50) || null },
      raw_excerpt: null,
    });
  }

  return signals;
}

async function safeFetch(url: string): Promise<string | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT);
    const r = await fetch(url, {
      headers: { 'User-Agent': 'CSW-GeoVerify/1.0' },
      redirect: 'follow',
      signal: ctl.signal,
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('html') && !ct.includes('text')) return null;
    const text = await r.text();
    return text.slice(0, MAX_BODY);
  } catch { return null; }
}

function contentHash(sig: GeoSignal, universityId: string, jobId: string): string {
  // Include job_id to avoid cross-job dedup collisions (unique index is university_id + content_hash)
  const key = `${jobId}|${universityId}|${sig.source_type}|${sig.source_url}|${sig.entity_type}|${sig.detected_lat}|${sig.detected_lon}|${sig.detected_address}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

// --- Confidence scoring ---

function scoreEvidence(signals: GeoSignal[], currentCountry: string | null, currentCity: string | null) {
  let score = 0;
  const issues: string[] = [];
  const countryCounts: Record<string, number> = {};
  const cityCounts: Record<string, number> = {};
  let bestAddress: string | null = null;
  let bestLat: number | null = null;
  let bestLon: number | null = null;
  let bestConfidence = 0;
  const sources: Set<string> = new Set();

  for (const sig of signals) {
    if (sig.entity_type !== 'university_main') continue;
    score += sig.confidence;
    sources.add(sig.source_type);
    if (sig.detected_country_code) {
      const cc = sig.detected_country_code.toUpperCase();
      countryCounts[cc] = (countryCounts[cc] || 0) + 1;
    }
    if (sig.detected_city) {
      const city = sig.detected_city.toLowerCase().trim();
      cityCounts[city] = (cityCounts[city] || 0) + 1;
    }
    if (sig.detected_address && sig.confidence > bestConfidence) {
      bestAddress = sig.detected_address;
      bestConfidence = sig.confidence;
    }
    if (sig.detected_lat && sig.detected_lon && (!bestLat || sig.confidence > bestConfidence)) {
      bestLat = sig.detected_lat;
      bestLon = sig.detected_lon;
    }
  }

  const resolvedCountry = Object.entries(countryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const resolvedCity = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  if (Object.keys(countryCounts).length > 1) { issues.push('conflicting_countries'); score -= 25; }
  if (Object.keys(cityCounts).length > 2) { issues.push('multiple_campuses'); score -= 20; }

  const countryMatch = !resolvedCountry || !currentCountry || resolvedCountry === currentCountry.toUpperCase();
  const cityMatch = !resolvedCity || !currentCity || resolvedCity === currentCity.toLowerCase().trim();

  if (!countryMatch) issues.push('country_mismatch');
  if (!cityMatch) issues.push('city_mismatch');
  if (!bestLat || !bestLon) issues.push('no_resolved_coordinates');
  if (signals.length === 0) issues.push('no_signals_found');

  score = Math.min(100, Math.max(0, score));

  return {
    totalConfidence: score, resolvedCountry,
    resolvedCity: resolvedCity ? resolvedCity.charAt(0).toUpperCase() + resolvedCity.slice(1) : null,
    resolvedAddress: bestAddress, resolvedLat: bestLat, resolvedLon: bestLon,
    countryMatch, cityMatch, issues,
    resolutionSource: [...sources].join(',') || 'none',
  };
}

// --- Main handler ---

function respond(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = getSupabaseAdmin();
  const startMs = Date.now();

  try {
    const { university_id, job_id, row_id, trace_id } = await req.json();
    if (!university_id || !job_id || !row_id) {
      return respond({ ok: false, error: 'university_id, job_id, row_id required' }, 400);
    }

    const traceId = trace_id || `gvw-${crypto.randomUUID().slice(0, 8)}`;

    const tlog = (stage: string, status: string, extra: Record<string, any> = {}) => {
      console.log(JSON.stringify({
        fn: 'geo-verify-worker', trace_id: traceId, job_id, university_id,
        stage, status, ts: new Date().toISOString(), ...extra,
      }));
    };

    tlog('start', 'ok', { version: 'v4' });

    await supabase.from('geo_verification_rows').update({ trace_id: traceId }).eq('id', row_id);

    // 1. Fetch university
    const { data: uni, error: uniErr } = await supabase
      .from('universities')
      .select('id, name, website, country_code, city')
      .eq('id', university_id)
      .single();

    if (uniErr || !uni) {
      tlog('fetch_university', 'failed', { error: 'not_found' });
      await supabase.from('geo_verification_rows').update({
        status: 'failed', issues: ['university_not_found'], processed_at: new Date().toISOString(),
      }).eq('id', row_id);
      return respond({ ok: false, error: 'University not found' });
    }

    // 2. Validate website
    const website = uni.website?.trim();
    if (!website) {
      tlog('validate_website', 'unverifiable', { reason: 'no_website' });
      await supabase.from('geo_verification_rows').update({
        status: 'unverifiable', issues: ['no_website'], processed_at: new Date().toISOString(),
      }).eq('id', row_id);
      return respond({ ok: true, status: 'no_website', trace_id: traceId });
    }

    let baseUrl: string;
    try {
      baseUrl = new URL(website.startsWith('http') ? website : `https://${website}`).href;
    } catch {
      tlog('validate_website', 'failed', { reason: 'invalid_url' });
      await supabase.from('geo_verification_rows').update({
        status: 'failed', issues: ['website_invalid'], processed_at: new Date().toISOString(),
      }).eq('id', row_id);
      return respond({ ok: true, status: 'website_invalid', trace_id: traceId });
    }

    // 3. Fetch homepage
    const allSignals: GeoSignal[] = [];
    let pagesScanned = 0;

    tlog('fetch_homepage', 'start', { url: baseUrl });
    const homepage = await safeFetch(baseUrl);
    if (!homepage) {
      tlog('fetch_homepage', 'failed', { url: baseUrl });
      const retryStatus = 'flagged';
      await supabase.from('geo_verification_rows').update({
        status: retryStatus,
        issues: ['website_unreachable'],
        processed_at: new Date().toISOString(),
        raw_data: { retry_count: 1, last_error: 'website_unreachable', retryable: true },
      }).eq('id', row_id);
      return respond({ ok: true, status: retryStatus, retryable: true, trace_id: traceId });
    }
    pagesScanned++;
    tlog('fetch_homepage', 'ok', { bytes: homepage.length });

    // 4. Extract JSON-LD
    const jsonld = extractJsonLd(homepage);
    allSignals.push(...geoFromJsonLd(jsonld, baseUrl));

    // 5. Address patterns from homepage
    allSignals.push(...extractAddressFromText(homepage, baseUrl, 'official_site_homepage'));

    // 5b. Footer address
    allSignals.push(...extractFooterAddress(homepage, baseUrl));

    // 6. TLD signal
    const tldCountry = getTldCountry(baseUrl);
    if (tldCountry) {
      allSignals.push({
        source_type: 'official_site_tld', source_url: baseUrl,
        entity_type: 'university_main', entity_scope: null,
        detected_country_code: tldCountry, detected_city: null,
        detected_address: null, detected_lat: null, detected_lon: null,
        confidence: 5,
        signals: { tld_signal: true, tld: new URL(baseUrl).hostname.split('.').pop() },
        raw_excerpt: null,
      });
    }

    // 7. Discover and fetch internal pages
    const discovered = discoverGeoPages(homepage, baseUrl);
    tlog('discover_pages', 'ok', { geo: discovered.geo.length, housing: discovered.housing.length });

    for (const pageUrl of discovered.geo) {
      if (pagesScanned >= MAX_PAGES) break;
      const html = await safeFetch(pageUrl);
      if (!html) continue;
      pagesScanned++;
      const pageJsonLd = extractJsonLd(html);
      allSignals.push(...geoFromJsonLd(pageJsonLd, pageUrl));
      const sourceType = pageUrl.includes('contact') ? 'official_site_contact' :
                         pageUrl.includes('about') ? 'official_site_about' : 'official_site_subpage';
      allSignals.push(...extractAddressFromText(html, pageUrl, sourceType));
      allSignals.push(...extractFooterAddress(html, pageUrl));
    }

    // 8. Housing pages
    for (const pageUrl of discovered.housing) {
      if (pagesScanned >= MAX_PAGES) break;
      const html = await safeFetch(pageUrl);
      if (!html) continue;
      pagesScanned++;
      allSignals.push(...extractHousingSignals(html, pageUrl));
      const pageJsonLd = extractJsonLd(html);
      const housingJsonLdSignals = geoFromJsonLd(pageJsonLd, pageUrl);
      for (const s of housingJsonLdSignals) { s.entity_type = 'dorm'; s.entity_scope = 'housing'; }
      allSignals.push(...housingJsonLdSignals);
    }

    tlog('extraction', 'ok', { signals: allSignals.length, pages: pagesScanned });

    // ============================================================
    // PATCH E: CASCADING FALLBACK GEOCODING
    // Try in order: 1) full address, 2) city+country, 3) name+city+country, 4) name+country
    // ============================================================
    const hasLatLon = allSignals.some(s => s.entity_type === 'university_main' && s.detected_lat != null && s.detected_lon != null);
    
    if (!hasLatLon) {
      const addressSignals = allSignals
        .filter(s => s.entity_type === 'university_main' && s.detected_address)
        .sort((a, b) => b.confidence - a.confidence);

      const bestSig = addressSignals[0];
      const countryHint = allSignals.find(s => s.detected_country_code)?.detected_country_code || uni.country_code || null;
      
      // Build fallback chain
      const resolvedCity = allSignals
        .filter(s => s.detected_city)
        .sort((a, b) => b.confidence - a.confidence)[0]?.detected_city || uni.city || null;

      const fallbackChain: { query: string; source: string }[] = [];
      
      // 1) Full normalized address (JSON-LD or extracted)
      if (bestSig?.detected_address) {
        const source = bestSig.source_type === 'official_site_jsonld' ? 'jsonld_address' : 'extracted_address';
        fallbackChain.push({ query: bestSig.detected_address, source });
      }
      // 2) Cleaned city + country
      if (resolvedCity && countryHint) {
        fallbackChain.push({ query: `${resolvedCity}, ${countryHint}`, source: 'city_country_fallback' });
      }
      // 3) University name + city + country
      if (uni.name && resolvedCity && countryHint) {
        fallbackChain.push({ query: `${uni.name}, ${resolvedCity}, ${countryHint}`, source: 'name_city_country_fallback' });
      }
      // 4) University name + country (last resort)
      if (uni.name && countryHint) {
        fallbackChain.push({ query: `${uni.name}, ${countryHint}`, source: 'name_country_fallback' });
      }
      // 5) University name + city (no country)
      if (uni.name && uni.city && !countryHint) {
        fallbackChain.push({ query: `${uni.name}, ${uni.city}`, source: 'name_city_fallback' });
      }

      // Deduplicate queries
      const seen = new Set<string>();
      const uniqueChain = fallbackChain.filter(f => {
        const key = f.query.toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      let geocoded = false;
      for (const { query, source } of uniqueChain) {
        tlog('geocode_attempt', 'start', { query_source: source, query: query.slice(0, 120), country_hint: countryHint });
        
        // For non-full-address fallbacks, don't use countryHint as constraint 
        // (let Nominatim find it freely when querying by name)
        const hint = source.includes('fallback') ? null : countryHint;
        const geoResult = await geocodeAddress(query, hint, tlog);
        
        if (geoResult && !geoResult.error && geoResult.lat !== 0) {
          allSignals.push({
            source_type: 'nominatim_geocode', source_url: query,
            entity_type: 'university_main', entity_scope: 'geocoded',
            detected_country_code: geoResult.address_country_code,
            detected_city: cleanCity(geoResult.address_city),
            detected_address: geoResult.display_name,
            detected_lat: geoResult.lat,
            detected_lon: geoResult.lon,
            confidence: 10,
            signals: { geocoded: true, query_source: source, query: query.slice(0, 100), importance: geoResult.raw_response?.importance, fallback_step: uniqueChain.indexOf({ query, source }) + 1 },
            raw_excerpt: JSON.stringify(geoResult.raw_response).slice(0, 500),
          });
          tlog('geocode_attempt', 'success', { query_source: source, lat: geoResult.lat, lon: geoResult.lon, city: geoResult.address_city });
          geocoded = true;
          break; // Stop on first success
        } else {
          tlog('geocode_attempt', 'no_result', { query_source: source, query: query.slice(0, 120), error: geoResult?.error });
        }
        
        // Brief delay between Nominatim calls to respect rate limits
        await new Promise(r => setTimeout(r, 1100));
      }
      
      if (!geocoded && uniqueChain.length > 0) {
        tlog('geocode_chain', 'exhausted', { attempts: uniqueChain.length, sources: uniqueChain.map(f => f.source) });
      }
    } else {
      tlog('geocode_attempt', 'skip', { reason: 'already_has_latlon_from_signals' });
    }

    // 9. Write evidence rows with content_hash for dedupe
    if (allSignals.length > 0) {
      const evidenceRows = allSignals.map(s => ({
        university_id,
        job_id,
        source_type: s.source_type,
        source_url: s.source_url,
        entity_type: s.entity_type,
        entity_scope: s.entity_scope,
        detected_country_code: s.detected_country_code,
        detected_city: s.detected_city,
        detected_address: s.detected_address,
        detected_lat: s.detected_lat,
        detected_lon: s.detected_lon,
        confidence: s.confidence,
        signals: s.signals,
        raw_excerpt: s.raw_excerpt,
        content_hash: contentHash(s, university_id, job_id),
      }));

      let insertedCount = 0;
      for (const row of evidenceRows) {
        const { error: evidErr } = await supabase.from('university_geo_evidence').insert(row);
        if (evidErr) {
          if (evidErr.message?.includes('duplicate') || evidErr.message?.includes('unique')) continue;
          tlog('write_evidence_row', 'error', { error: evidErr.message });
        } else {
          insertedCount++;
        }
      }
      tlog('write_evidence', 'ok', { attempted: evidenceRows.length, inserted: insertedCount });
    }

    // 10. Score
    const result = scoreEvidence(allSignals, uni.country_code, uni.city);

    let hasRefCoords = false;
    if (uni.city) {
      const { count } = await supabase
        .from('city_coordinates')
        .select('id', { count: 'exact', head: true })
        .ilike('city_name', uni.city);
      hasRefCoords = (count || 0) > 0;
    }

    const BLOCKING_ISSUES = [
      'conflicting_countries',
      'multiple_campuses',
      'country_mismatch',
      'city_mismatch',
      'no_resolved_coordinates',
    ];
    const hasCriticalIssue = result.issues.some((i: string) => BLOCKING_ISSUES.includes(i));

    let status: string;
    if (result.totalConfidence >= 70 && !hasCriticalIssue && result.resolvedLat != null && result.resolvedLon != null) {
      status = 'verified';
    } else if (result.totalConfidence >= 40 || hasCriticalIssue) {
      status = 'flagged';
    } else if (allSignals.length === 0) {
      status = 'unverifiable';
    } else {
      status = 'flagged';
    }

    // 11. Update verification row
    await supabase.from('geo_verification_rows').update({
      university_name: uni.name,
      current_country_code: uni.country_code,
      current_city: uni.city,
      resolved_country_code: result.resolvedCountry,
      resolved_city: result.resolvedCity,
      resolved_address: result.resolvedAddress,
      resolved_lat: result.resolvedLat,
      resolved_lon: result.resolvedLon,
      has_reference_city_coordinates: hasRefCoords,
      country_match: result.countryMatch,
      city_match: result.cityMatch,
      coordinates_match: hasRefCoords && result.resolvedLat != null,
      confidence: result.totalConfidence,
      issues: result.issues,
      resolution_source: result.resolutionSource,
      status,
      raw_data: {
        pages_scanned: pagesScanned,
        signals_count: allSignals.length,
        housing_signals: allSignals.filter(s => s.entity_type === 'dorm').length,
        trace_id: traceId,
        worker_version: 'v4',
      },
      processed_at: new Date().toISOString(),
    }).eq('id', row_id);

    // 12. Housing locations — only insert if we have a REAL location, not just page discovery
    const housingSignals = allSignals.filter(s => 
      s.entity_type === 'dorm' && 
      s.entity_scope !== 'housing_page_only' && // exclude page-only discoveries
      s.detected_address
    );
    if (housingSignals.length > 0) {
      const housingRows = housingSignals.slice(0, 3).map((s, i) => ({
        university_id,
        name: null, // don't use raw_excerpt as name
        address: s.detected_address,
        city: s.detected_city || result.resolvedCity,
        country_code: s.detected_country_code || result.resolvedCountry || uni.country_code,
        lat: s.detected_lat,
        lon: s.detected_lon,
        is_primary: i === 0,
        source_url: s.source_url,
        confidence: s.confidence,
        status: 'discovered',
      }));
      await supabase.from('university_housing_locations').insert(housingRows);
    }

    const elapsedMs = Date.now() - startMs;
    tlog('complete', status, {
      confidence: result.totalConfidence,
      issues: result.issues,
      signals: allSignals.length,
      pages: pagesScanned,
      elapsed_ms: elapsedMs,
      geocoded: allSignals.some(s => s.source_type === 'nominatim_geocode'),
    });

    return respond({
      ok: true, status, trace_id: traceId,
      confidence: result.totalConfidence,
      issues: result.issues,
      signals_count: allSignals.length,
      pages_scanned: pagesScanned,
      elapsed_ms: elapsedMs,
    });

  } catch (err: any) {
    console.error(JSON.stringify({
      fn: 'geo-verify-worker', stage: 'fatal', status: 'error',
      error: err.message, ts: new Date().toISOString(),
    }));
    return respond({ ok: false, error: err.message }, 500);
  }
});
