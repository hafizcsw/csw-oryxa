/**
 * osm-city-university-overlay  v3
 * ---
 * Matching V2: domain match as top signal, transliteration as helper.
 * The map owns the PLACE. We own the UNIVERSITY.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const CACHE_TTL_DAYS = 30;
const BBOX_FALLBACK_DEG = 0.35;
const MATCH_THRESHOLD = 55;
const AMBIGUOUS_GAP = 15;

/* ── Types ── */
interface UniversityInput {
  id: string;
  name_en: string | null;
  name_ar: string | null;
  name: string | null;
  aliases?: string[];
  website?: string | null;
}

interface OsmElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/* ── Russian → Latin transliteration (GOST 7.79-2000 simplified) ── */
const CYRILLIC_MAP: Record<string, string> = {
  'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh',
  'з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o',
  'п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts',
  'ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
};

function transliterate(text: string): string {
  return text.toLowerCase().split('').map(c => CYRILLIC_MAP[c] ?? c).join('');
}

/* ── Domain extraction ── */
function extractDomain(url: string): string | null {
  if (!url) return null;
  try {
    let hostname = url.includes('://') ? new URL(url).hostname : url;
    hostname = hostname.replace(/^www\./i, '').toLowerCase();
    return hostname || null;
  } catch {
    return null;
  }
}

function extractETLD1(hostname: string): string {
  const parts = hostname.split('.');
  const twoPartTLDs = ['ac.uk','co.uk','org.uk','edu.au','com.au','co.jp','ac.jp','or.jp','co.za','ac.ru','edu.ru'];
  if (parts.length >= 3) {
    const lastTwo = parts.slice(-2).join('.');
    if (twoPartTLDs.includes(lastTwo)) return parts.slice(-3).join('.');
  }
  return parts.length >= 2 ? parts.slice(-2).join('.') : hostname;
}

/* ── Name normalization ── */
const STOP_WORDS = new Set([
  "university","of","the","and","institute","college","school",
  "national","state","federal","technical","technological",
  "polytechnic","academy","faculty","department","center","centre",
  "for","in","at","named","after",
  "университет","институт","академия","государственный","федеральный",
  "национальный","технический","политехнический","имени","высшая","школа",
  "российский","московский","исследовательский","областной",
  "جامعة","معهد","كلية","أكاديمية","المعهد","الجامعة","الكلية",
]);

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''`"«»()[\]{}.,:;!?]/g, "")
    .replace(/[-_–—/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(t => t.length > 1 && !STOP_WORDS.has(t))
    .join(" ");
}

function tokenize(s: string): Set<string> {
  return new Set(s.split(/\s+/).filter(t => t.length > 1));
}

/* ── Extract all name variants from an OSM element ── */
function getOsmNames(el: OsmElement): string[] {
  const tags = el.tags || {};
  const names: string[] = [];
  for (const key of [
    "name","name:en","name:ar","name:ru","name:fr","name:de",
    "name:es","name:tr","name:zh","short_name","alt_name",
    "official_name","old_name","operator","brand",
  ]) {
    if (tags[key] && !names.includes(tags[key])) names.push(tags[key]);
  }
  for (const [k, v] of Object.entries(tags)) {
    if (k.startsWith("name:") && v && !names.includes(v)) names.push(v);
  }
  return names;
}

/* ── Extract OSM websites ── */
function getOsmWebsites(el: OsmElement): string[] {
  const tags = el.tags || {};
  const urls: string[] = [];
  for (const key of ["website", "contact:website", "url", "official_website"]) {
    if (tags[key]) {
      // Some tags contain multiple URLs separated by ;
      for (const u of tags[key].split(';')) {
        const trimmed = u.trim();
        if (trimmed) urls.push(trimmed);
      }
    }
  }
  return urls;
}

/* ── Scoring logic ── */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  const intersection = [...a].filter(x => b.has(x));
  const union = new Set([...a, ...b]);
  return intersection.length / union.size;
}

/* LCS removed — too CPU-expensive for edge functions with large datasets */

interface MatchResult {
  score: number;
  bestOurName: string;
  bestOsmName: string;
  matchMethod: string;
}

/**
 * Domain matching — strongest signal, language-independent.
 * Returns score 98 if eTLD+1 matches, 90 if full domain matches.
 */
function scoreDomainMatch(
  ourWebsite: string | null | undefined,
  osmEl: OsmElement
): { score: number; method: string } | null {
  if (!ourWebsite) return null;
  const ourDomain = extractDomain(ourWebsite);
  if (!ourDomain) return null;
  const ourETLD1 = extractETLD1(ourDomain);

  const osmUrls = getOsmWebsites(osmEl);
  for (const osmUrl of osmUrls) {
    const osmDomain = extractDomain(osmUrl);
    if (!osmDomain) continue;
    const osmETLD1 = extractETLD1(osmDomain);

    // Exact domain match
    if (ourDomain === osmDomain) return { score: 98, method: "domain_exact" };
    // eTLD+1 match (handles subdomains)
    if (ourETLD1 === osmETLD1) return { score: 95, method: "domain_etld1" };
  }
  return null;
}

/**
 * Name-based scoring with transliteration support.
 */
function scoreNameMatch(ourNames: string[], osmNames: string[]): MatchResult {
  let best: MatchResult = { score: 0, bestOurName: "", bestOsmName: "", matchMethod: "none" };

  // Build expanded name lists with transliterations
  const expandedOurNames: { raw: string; norm: string }[] = [];
  for (const raw of ourNames) {
    if (!raw) continue;
    const norm = normalize(raw);
    if (norm) expandedOurNames.push({ raw, norm });
    // If name has Cyrillic, also add transliterated version
    if (/[\u0400-\u04FF]/.test(raw)) {
      const translit = normalize(transliterate(raw));
      if (translit) expandedOurNames.push({ raw: `[translit] ${raw}`, norm: translit });
    }
  }

  const expandedOsmNames: { raw: string; norm: string }[] = [];
  for (const raw of osmNames) {
    if (!raw) continue;
    const norm = normalize(raw);
    if (norm) expandedOsmNames.push({ raw, norm });
    if (/[\u0400-\u04FF]/.test(raw)) {
      const translit = normalize(transliterate(raw));
      if (translit) expandedOsmNames.push({ raw: `[translit] ${raw}`, norm: translit });
    }
  }

  for (const our of expandedOurNames) {
    const ourTokens = tokenize(our.norm);
    for (const osm of expandedOsmNames) {
      const osmTokens = tokenize(osm.norm);
      let score = 0;
      let method = "name_partial";

      // Exact normalized match
      if (our.norm === osm.norm) {
        score = 92;
        method = "name_exact";
      } else {
        // Token Jaccard — fast check, skip expensive LCS if zero overlap
        const jaccard = jaccardSimilarity(ourTokens, osmTokens);
        const jaccardScore = Math.round(jaccard * 55);
        score += jaccardScore;

        // Early exit: if no token overlap at all, skip expensive checks
        if (jaccardScore === 0) {
          // Still check substring for acronym-like matches
          if (our.norm.length >= 4 && osm.norm.length >= 4 &&
              (our.norm.includes(osm.norm) || osm.norm.includes(our.norm))) {
            score += 20;
          }
          // Skip LCS entirely — no point if zero token overlap
        } else {
          // Substring containment (+20)
          if (our.norm.length >= 4 && osm.norm.length >= 4 &&
              (our.norm.includes(osm.norm) || osm.norm.includes(our.norm))) {
            score += 20;
          }

          // High token overlap (+15)
          const overlapCount = [...ourTokens].filter(t => osmTokens.has(t)).length;
          const overlapRatio = overlapCount / Math.max(ourTokens.size, 1);
          if (overlapRatio >= 0.6) score += 15;
          else if (overlapRatio >= 0.4) score += 8;
        }
      }

      if (score > best.score) {
        best = { score, bestOurName: our.raw, bestOsmName: osm.raw, matchMethod: method };
      }
    }
  }

  return best;
}

/* ── Validate element is a real university POI ── */
function isValidUniversityPOI(el: OsmElement): boolean {
  const tags = el.tags || {};
  const amenity = tags.amenity || "";
  if (!["university", "college"].includes(amenity)) return false;
  if (tags.boundary || tags.admin_level) return false;
  if (!tags.name && !tags["name:en"] && !tags["name:ru"] && !tags["name:ar"]) return false;
  return true;
}

/* ── Overpass: area-based query ── */
async function queryOverpassArea(cityName: string, countryCode: string): Promise<OsmElement[]> {
  const query = `[out:json][timeout:15];
area["ISO3166-1"="${countryCode.toUpperCase()}"]->.country;
area["name"="${cityName}"]["place"~"city|town"](area.country)->.searchArea;
(
  nwr["amenity"="university"](area.searchArea);
  nwr["amenity"="college"](area.searchArea);
);
out center tags;`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const resp = await fetch(OVERPASS_URL, {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.elements || []).filter(isValidUniversityPOI);
  } catch {
    clearTimeout(timer);
    return [];
  }
}

/* ── Overpass: bbox query (includes tags for website) ── */
async function queryOverpassBbox(lat: number, lon: number, radiusDeg: number): Promise<OsmElement[]> {
  const south = lat - radiusDeg;
  const north = lat + radiusDeg;
  const west = lon - radiusDeg;
  const east = lon + radiusDeg;

  const query = `[out:json][timeout:10];(nwr["amenity"="university"](${south},${west},${north},${east});nwr["amenity"="college"](${south},${west},${north},${east}););out center tags;`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const resp = await fetch(OVERPASS_URL, {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) {
      console.error(`Overpass bbox failed (${resp.status})`);
      return [];
    }
    const data = await resp.json();
    return (data.elements || []).filter(isValidUniversityPOI);
  } catch {
    clearTimeout(timer);
    console.warn("[osm-overlay-v3] Overpass bbox timed out");
    return [];
  }
}

/* ── Main handler ── */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { city_name, country_code, city_lat, city_lon, universities: inputUnis } = body;

    if (!city_name || !country_code || city_lat == null || city_lon == null || !inputUnis?.length) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const uniIds = inputUnis.map((u: any) => u.id);

    // ── Fetch enrichment data in parallel ──
    const [aliasRes, nameRes, websiteRes] = await Promise.all([
      supabase.from("university_aliases").select("university_id, alias").in("university_id", uniIds),
      supabase.from("universities").select("id, name").in("id", uniIds),
      supabase.from("universities").select("id, website").in("id", uniIds),
    ]);

    const aliasMap = new Map<string, string[]>();
    for (const row of aliasRes.data || []) {
      const key = String(row.university_id);
      if (!aliasMap.has(key)) aliasMap.set(key, []);
      aliasMap.get(key)!.push(row.alias);
    }

    const rawNameMap = new Map<string, string>();
    for (const row of nameRes.data || []) rawNameMap.set(String(row.id), row.name);

    const websiteMap = new Map<string, string>();
    for (const row of websiteRes.data || []) {
      if (row.website) websiteMap.set(String(row.id), row.website);
    }

    const universities: UniversityInput[] = inputUnis.map((u: any) => ({
      id: u.id,
      name_en: u.name_en,
      name_ar: u.name_ar,
      name: rawNameMap.get(u.id) || null,
      aliases: aliasMap.get(u.id) || [],
      website: websiteMap.get(u.id) || null,
    }));

    // ── 1. Check cache ──
    const cutoff = new Date(Date.now() - CACHE_TTL_DAYS * 86_400_000).toISOString();
    const { data: cached } = await supabase
      .from("university_geo_matches")
      .select("*")
      .eq("city_name", city_name)
      .eq("country_code", country_code.toUpperCase())
      .eq("provider", "osm_overpass")
      .in("university_id", uniIds)
      .gte("resolved_at", cutoff);

    const cachedMap = new Map<string, any>();
    for (const c of cached || []) cachedMap.set(c.university_id, c);

    const uncachedAll = universities.filter(u => !cachedMap.has(u.id));
    // Cap per invocation to avoid CPU timeout on large cities
    const MAX_UNCACHED = 40;
    const uncachedUnis = uncachedAll.slice(0, MAX_UNCACHED);
    if (uncachedAll.length > MAX_UNCACHED) {
      console.log(`[osm-overlay-v3] Capped: processing ${MAX_UNCACHED} of ${uncachedAll.length} uncached`);
    }
    const newMatches: any[] = [];

    if (uncachedUnis.length > 0) {
      // ── 2. Query Overpass ──
      console.log(`[osm-overlay-v3] Querying Overpass for ${city_name}, ${country_code} (${uncachedUnis.length} uncached)`);

      let osmElements: OsmElement[] = [];
      try {
        osmElements = await queryOverpassBbox(city_lat, city_lon, BBOX_FALLBACK_DEG);
        console.log(`[osm-overlay-v3] Bbox returned ${osmElements.length} POIs`);

        if (osmElements.length < 3) {
          try {
            const areaElements = await queryOverpassArea(city_name, country_code);
            console.log(`[osm-overlay-v3] Area supplement returned ${areaElements.length} POIs`);
            const existingIds = new Set(osmElements.map(e => `${e.type}:${e.id}`));
            for (const el of areaElements) {
              if (!existingIds.has(`${el.type}:${el.id}`)) osmElements.push(el);
            }
          } catch (_) {}
        }
      } catch (e) {
        console.error("[osm-overlay-v3] Overpass error:", e);
        try {
          osmElements = await queryOverpassBbox(city_lat, city_lon, BBOX_FALLBACK_DEG);
        } catch (_) {}
      }

      // ── Log OSM website/wikidata coverage ──
      let osmWithWebsite = 0;
      let osmWithWikidata = 0;
      for (const el of osmElements) {
        const t = el.tags || {};
        if (t.website || t["contact:website"] || t.url) osmWithWebsite++;
        if (t.wikidata) osmWithWikidata++;
      }
      console.log(`[osm-overlay-v3] OSM POI stats: ${osmElements.length} total, ${osmWithWebsite} with website, ${osmWithWikidata} with wikidata`);

      // ── Pre-build domain→element index for O(1) domain lookups ──
      const domainIndex = new Map<string, OsmElement[]>();
      for (const el of osmElements) {
        const urls = getOsmWebsites(el);
        for (const url of urls) {
          const d = extractDomain(url);
          if (!d) continue;
          const etld = extractETLD1(d);
          if (!domainIndex.has(d)) domainIndex.set(d, []);
          domainIndex.get(d)!.push(el);
          if (etld !== d) {
            if (!domainIndex.has(etld)) domainIndex.set(etld, []);
            domainIndex.get(etld)!.push(el);
          }
        }
      }

      // ── 3. Match each uncached university ──
      for (const uni of uncachedUnis) {
        const ourNames = [uni.name_en, uni.name_ar, uni.name, ...(uni.aliases || [])].filter(
          (n): n is string => !!n
        );

        let bestMatch: {
          element: OsmElement;
          score: number;
          matchedName: string;
          ourName: string;
          method: string;
        } | null = null;
        let secondBest = 0;

        // === FAST PATH: Domain index lookup ===
        let domainMatched = false;
        if (uni.website) {
          const ourDomain = extractDomain(uni.website);
          if (ourDomain) {
            const ourETLD1 = extractETLD1(ourDomain);
            // Check exact domain first
            const exactHits = domainIndex.get(ourDomain) || [];
            for (const el of exactHits) {
              bestMatch = {
                element: el,
                score: 98,
                matchedName: (el.tags?.name || el.tags?.["name:en"] || "domain-match"),
                ourName: uni.website!,
                method: "domain_exact",
              };
              domainMatched = true;
              break;
            }
            // Fallback: eTLD+1
            if (!domainMatched) {
              const etldHits = domainIndex.get(ourETLD1) || [];
              for (const el of etldHits) {
                bestMatch = {
                  element: el,
                  score: 95,
                  matchedName: (el.tags?.name || el.tags?.["name:en"] || "domain-match"),
                  ourName: uni.website!,
                  method: "domain_etld1",
                };
                domainMatched = true;
                break;
              }
            }
          }
        }

        // === SLOW PATH: Name matching (only if no domain match) ===
        if (!domainMatched) {
          for (const el of osmElements) {
            const osmNames = getOsmNames(el);
            if (osmNames.length === 0) continue;

            const nameResult = scoreNameMatch(ourNames, osmNames);
            if (nameResult.score > (bestMatch?.score || 0)) {
              secondBest = bestMatch?.score || 0;
              bestMatch = {
                element: el,
                score: nameResult.score,
                matchedName: nameResult.bestOsmName,
                ourName: nameResult.bestOurName,
                method: nameResult.matchMethod,
              };
            } else if (nameResult.score > secondBest) {
              secondBest = nameResult.score;
            }
          }
        }

        let match_status = "unmatched";
        let lat: number | null = null;
        let lon: number | null = null;
        let osm_type: string | null = null;
        let osm_id: number | null = null;
        let matched_name: string | null = null;
        let match_confidence = 0;
        let match_method = "none";

        if (bestMatch && bestMatch.score >= MATCH_THRESHOLD) {
          // Domain matches bypass ambiguity check
          if (bestMatch.method.startsWith("domain_")) {
            match_status = "matched";
          } else if (secondBest >= MATCH_THRESHOLD && bestMatch.score - secondBest < AMBIGUOUS_GAP) {
            match_status = "ambiguous";
          } else {
            match_status = "matched";
          }

          const el = bestMatch.element;
          lat = el.lat ?? el.center?.lat ?? null;
          lon = el.lon ?? el.center?.lon ?? null;
          osm_type = el.type;
          osm_id = el.id;
          matched_name = bestMatch.matchedName;
          match_confidence = bestMatch.score;
          match_method = bestMatch.method;
        } else if (bestMatch && bestMatch.score >= 40) {
          match_status = "ambiguous";
          match_confidence = bestMatch.score;
          matched_name = bestMatch.matchedName;
          match_method = bestMatch.method;
        }

        const record = {
          university_id: uni.id,
          provider: "osm_overpass",
          city_name,
          country_code: country_code.toUpperCase(),
          osm_type,
          osm_id,
          matched_name,
          lat,
          lon,
          match_confidence,
          match_status,
          query_version: "v3_domain",
          raw_json: bestMatch
            ? {
                tags: bestMatch.element.tags,
                type: bestMatch.element.type,
                id: bestMatch.element.id,
                our_best_name: bestMatch.ourName,
                match_method: bestMatch.method,
                our_website: uni.website,
              }
            : { our_website: uni.website, reason: "no_candidates" },
          resolved_at: new Date().toISOString(),
        };

        newMatches.push(record);
      }

      // ── 4. Upsert cache ──
      if (newMatches.length > 0) {
        const { error: upsertErr } = await supabase
          .from("university_geo_matches")
          .upsert(newMatches, {
            onConflict: "provider,university_id,city_name,country_code",
          });
        if (upsertErr) console.error("[osm-overlay-v3] Cache upsert error:", upsertErr);
      }

      // ── Summary log ──
      const matched = newMatches.filter(m => m.match_status === "matched").length;
      const ambiguous = newMatches.filter(m => m.match_status === "ambiguous").length;
      const unmatched = newMatches.filter(m => m.match_status === "unmatched").length;
      const byMethod: Record<string, number> = {};
      for (const m of newMatches) {
        const method = m.raw_json?.match_method || "none";
        byMethod[method] = (byMethod[method] || 0) + 1;
      }
      console.log(`[osm-overlay-v3] ${city_name}: ${matched} matched, ${ambiguous} ambiguous, ${unmatched} unmatched | methods: ${JSON.stringify(byMethod)}`);
    }

    // ── 5. Build response ──
    const results = universities.map(u => {
      const c = cachedMap.get(u.id);
      const f = newMatches.find(m => m.university_id === u.id);
      const match = c || f;
      return {
        university_id: u.id,
        lat: match?.lat ?? null,
        lon: match?.lon ?? null,
        osm_type: match?.osm_type ?? null,
        osm_id: match?.osm_id ?? null,
        matched_name: match?.matched_name ?? null,
        match_confidence: match?.match_confidence ?? null,
        match_status: (match?.match_status as string) ?? "unmatched",
      };
    });

    return new Response(
      JSON.stringify({ universities: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[osm-overlay-v3] Fatal error:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
