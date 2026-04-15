/**
 * Door5 Phase 0 — StudyInRussia University Index Crawler
 * 
 * Two phases via body.phase:
 * - "fetch" (default): Scrape index page → extract seeds → bulk upsert to university_external_ids (no matching)
 * - "match": Read unmatched seeds → match against universities table with time budget
 * 
 * v5 — Full Coverage Patch:
 * - Primary URL: /en/university (single page, 123 universities)
 * - Extracts from links + HTML href + markdown fallback
 * - Map API only if seed_count < 110, with 10s timeout
 * - Preserves existing university_id/match_method on re-fetch (non-destructive)
 * - Comprehensive telemetry with trace_id
 */
import { getSupabaseAdmin } from '../_shared/supabase.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-client-trace-id, x-orxya-ingress',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SOURCE_NAME = 'studyinrussia';
const BASE_URL = 'https://studyinrussia.ru';
const INDEX_URL = `${BASE_URL}/en/university`;
const PARSER_VERSION = 'd5-index-v5';
const TIME_BUDGET_MS = 45_000;
const UPSERT_CHUNK = 10;
const MAP_TIMEOUT_MS = 12_000;
const MAP_THRESHOLD = 110; // Only use Map API if seeds < this

interface SirSeed {
  name_en: string;
  sir_id: string;
  source_url: string;
}

function extractSeedsFromLinks(links: string[]): SirSeed[] {
  const seeds: SirSeed[] = [];
  const seen = new Set<string>();
  for (const link of links) {
    const m = link.match(/university-show\/(\d+)/);
    if (m) {
      const sirId = m[1];
      if (seen.has(sirId)) continue;
      seen.add(sirId);
      seeds.push({ name_en: '', sir_id: sirId, source_url: `${BASE_URL}/en/university-show/${sirId}/about` });
    }
  }
  return seeds;
}

/** Extract university-show IDs from raw HTML href attributes */
function extractSeedsFromHtml(html: string, existingIds: Set<string>): SirSeed[] {
  const seeds: SirSeed[] = [];
  const pattern = /href="[^"]*university-show\/(\d+)[^"]*"/gi;
  let m;
  while ((m = pattern.exec(html)) !== null) {
    const sirId = m[1];
    if (existingIds.has(sirId)) continue;
    existingIds.add(sirId);
    seeds.push({ name_en: '', sir_id: sirId, source_url: `${BASE_URL}/en/university-show/${sirId}/about` });
  }
  return seeds;
}

/** Extract university-show IDs from markdown content */
function extractSeedsFromMarkdown(md: string, existingIds: Set<string>): SirSeed[] {
  const seeds: SirSeed[] = [];
  // Pattern: [University Name](url-with-university-show/ID)
  const pattern = /\[([^\]]+)\]\([^)]*university-show\/(\d+)[^)]*\)/gi;
  let m;
  while ((m = pattern.exec(md)) !== null) {
    const name = m[1].trim();
    const sirId = m[2];
    if (existingIds.has(sirId)) {
      // Enrich existing seed with name
      continue;
    }
    existingIds.add(sirId);
    seeds.push({ name_en: name, sir_id: sirId, source_url: `${BASE_URL}/en/university-show/${sirId}/about` });
  }
  return seeds;
}

/** Extract seeds from HTML <option value="ID"> tags — this is the PRIMARY source for all 123 IDs */
function extractSeedsFromOptions(html: string, existingIds: Set<string>): SirSeed[] {
  const SKIP = new Set(['More details', 'more details', 'Подробнее', 'Details', '', 'University']);
  const seeds: SirSeed[] = [];
  const optionPattern = /<option\s+value="(\d+)"[^>]*>([^<]+)<\/option>/gi;
  let m;
  while ((m = optionPattern.exec(html)) !== null) {
    const sirId = m[1];
    const name = m[2].trim();
    if (SKIP.has(name) || name.length <= 2) continue;
    if (existingIds.has(sirId)) {
      // Just a name enrichment for existing seed — handled below
      continue;
    }
    existingIds.add(sirId);
    seeds.push({ name_en: name, sir_id: sirId, source_url: `${BASE_URL}/en/university-show/${sirId}/about` });
  }
  return seeds;
}

function enrichSeedsFromHtml(seeds: SirSeed[], content: string): number {
  const SKIP = new Set(['More details', 'more details', 'Подробнее', 'Details', '', 'University']);
  let enriched = 0;
  const optionPattern = /<option\s+value="(\d+)"[^>]*>([^<]+)<\/option>/gi;
  let m;
  while ((m = optionPattern.exec(content)) !== null) {
    const sirId = m[1];
    const name = m[2].trim();
    if (SKIP.has(name) || name.length <= 2) continue;
    const seed = seeds.find(s => s.sir_id === sirId);
    if (seed && !seed.name_en) { seed.name_en = name; enriched++; }
  }
  return enriched;
}

/** Enrich seed names from markdown link text */
function enrichSeedsFromMarkdown(seeds: SirSeed[], md: string): number {
  let enriched = 0;
  const pattern = /\[([^\]]+)\]\([^)]*university-show\/(\d+)[^)]*\)/gi;
  let m;
  while ((m = pattern.exec(md)) !== null) {
    const name = m[1].trim();
    const sirId = m[2];
    if (name.length <= 2 || name === 'More details') continue;
    const seed = seeds.find(s => s.sir_id === sirId);
    if (seed && !seed.name_en) { seed.name_en = name; enriched++; }
  }
  return enriched;
}

/** Strip parenthetical abbreviations */
function stripParens(name: string): string {
  return name.replace(/\s*\([^)]*\)/g, '').trim();
}

/** Normalize for matching */
function normalizeName(name: string): string {
  return stripParens(name)
    .replace(/named after\s+.*/i, '')
    .replace(/\bnamed\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function extractKeywords(name: string): string[] {
  const STOP = new Set(['state', 'university', 'national', 'research', 'federal', 'the', 'and', 'for', 'named', 'after', 'of']);
  return normalizeName(name)
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP.has(w));
}

function keywordScore(a: string, b: string): number {
  const ka = extractKeywords(a);
  const kb = extractKeywords(b);
  if (ka.length === 0 || kb.length === 0) return 0;
  const setB = new Set(kb);
  const matches = ka.filter(w => setB.has(w)).length;
  return matches / Math.min(ka.length, kb.length);
}

async function matchToExisting(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  seed: SirSeed,
  ruUniversities: Array<{ id: string; name_en: string | null; name: string | null; slug: string }>,
  aliasMap: Map<string, string>
): Promise<{ university_id: string | null; method: string; confidence: number }> {
  // 1. Already mapped
  const { data: existing } = await supabase
    .from('university_external_ids')
    .select('university_id')
    .eq('source_name', SOURCE_NAME)
    .eq('external_id', seed.sir_id)
    .not('university_id', 'is', null)
    .maybeSingle();
  if (existing?.university_id) return { university_id: existing.university_id, method: 'existing_map', confidence: 1.0 };

  if (!seed.name_en) return { university_id: null, method: 'unmatched', confidence: 0 };

  const stripped = stripParens(seed.name_en);
  const normalized = normalizeName(seed.name_en);

  // 2. Exact name match
  const exactMatch = ruUniversities.find(u => u.name_en?.toLowerCase() === seed.name_en.toLowerCase());
  if (exactMatch) return { university_id: exactMatch.id, method: 'name_exact', confidence: 0.95 };

  // 3. Alias match
  const aliasId = aliasMap.get(seed.name_en.toLowerCase()) 
    || aliasMap.get(stripped.toLowerCase()) 
    || aliasMap.get(normalized);
  if (aliasId) return { university_id: aliasId, method: 'alias_exact', confidence: 0.93 };

  // 4. Stripped match
  const strippedMatch = ruUniversities.find(u => u.name_en?.toLowerCase() === stripped.toLowerCase());
  if (strippedMatch) return { university_id: strippedMatch.id, method: 'name_stripped', confidence: 0.9 };

  // 5. Stripped alias
  const strippedNorm = normalizeName(stripped);
  const aliasStrippedId = aliasMap.get(strippedNorm);
  if (aliasStrippedId) return { university_id: aliasStrippedId, method: 'alias_stripped', confidence: 0.88 };

  // 6. Contains with word boundary
  const containsMatch = ruUniversities.find(u => {
    if (!u.name_en) return false;
    const uNorm = normalizeName(u.name_en);
    const shorter = normalized.length < uNorm.length ? normalized : uNorm;
    const longer = normalized.length < uNorm.length ? uNorm : normalized;
    if (shorter.length / longer.length < 0.6) return false;
    const regex = new RegExp(`\\b${shorter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    return regex.test(longer);
  });
  if (containsMatch) return { university_id: containsMatch.id, method: 'name_contains', confidence: 0.85 };

  // 7. Keyword scoring (threshold 0.5)
  let bestScore = 0;
  let bestMatch: typeof ruUniversities[0] | null = null;
  for (const u of ruUniversities) {
    if (!u.name_en) continue;
    const score = keywordScore(seed.name_en, u.name_en);
    if (score > bestScore) { bestScore = score; bestMatch = u; }
  }
  if (bestMatch && bestScore >= 0.5) {
    return { university_id: bestMatch.id, method: 'fuzzy', confidence: Math.round(bestScore * 100) / 100 };
  }

  // 8. Slug-based
  const sirSlug = stripped.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const slugMatch = ruUniversities.find(u => u.slug === sirSlug);
  if (slugMatch) return { university_id: slugMatch.id, method: 'slug', confidence: 0.85 };

  return { university_id: null, method: 'unmatched', confidence: 0 };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = getSupabaseAdmin();
    const traceId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const t0 = Date.now();

    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY_1') || Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlKey) {
      return new Response(JSON.stringify({ error: 'FIRECRAWL_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json().catch(() => ({}));
    const phase = (body as any)?.phase || 'fetch';
    const limit = (body as any)?.limit || 999;
    const cursorExternalId = (body as any)?.cursor_external_id || null;

    console.log(`[D5-Index-v5] trace=${traceId} phase=${phase} limit=${limit} index_url=${INDEX_URL}`);

    // ═══════════════════════════════════════════
    // PHASE: FETCH
    // ═══════════════════════════════════════════
    if (phase === 'fetch') {
      // Count existing matches BEFORE fetch (for preservation verification)
      const { count: matchedBefore } = await supabase
        .from('university_external_ids')
        .select('*', { count: 'exact', head: true })
        .eq('source_name', SOURCE_NAME)
        .not('university_id', 'is', null);

      const fcResp = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: INDEX_URL, formats: ['links', 'html', 'markdown'], waitFor: 3000 }),
      });
      const fcData = await fcResp.json();
      const links: string[] = fcData?.data?.links || fcData?.links || [];
      const html: string = fcData?.data?.html || fcData?.html || '';
      const markdown: string = fcData?.data?.markdown || fcData?.markdown || '';
      const targetStatus = fcData?.data?.metadata?.statusCode ?? null;

      console.log(`[D5-Index-v5] Firecrawl: ${links.length} links, html=${html.length}c, md=${markdown.length}c in ${Date.now() - t0}ms`);

      // Log the actual URL used
      await supabase.from('raw_pages').insert({
        url: INDEX_URL, status_code: targetStatus, content_type: 'text/html',
        fetched_at: startedAt, text_content: html.substring(0, 500000),
        source_name: SOURCE_NAME, page_type: 'sir_university_index',
        trace_id: traceId, parser_version: PARSER_VERSION,
      });

      // Extract seeds from ALL sources
      let seeds = extractSeedsFromLinks(links);
      const existingIds = new Set(seeds.map(s => s.sir_id));
      const linksCount = seeds.length;

      // PRIMARY: Extract from <option value="ID"> tags — contains ALL 123 IDs
      const optionSeeds = extractSeedsFromOptions(html, existingIds);
      seeds.push(...optionSeeds);
      const optionExtraCount = optionSeeds.length;

      // HTML href fallback
      const htmlSeeds = extractSeedsFromHtml(html, existingIds);
      seeds.push(...htmlSeeds);
      const htmlExtraCount = htmlSeeds.length;

      // Markdown fallback
      const mdSeeds = extractSeedsFromMarkdown(markdown, existingIds);
      seeds.push(...mdSeeds);
      const mdExtraCount = mdSeeds.length;

      console.log(`[D5-Index-v5] Seeds: links=${linksCount} +options=${optionExtraCount} +html=${htmlExtraCount} +md=${mdExtraCount} = ${seeds.length} total`);

      // Map API fallback ONLY if below threshold
      let mapSkipped = false;
      let mapExtra = 0;
      if (seeds.length < MAP_THRESHOLD && (Date.now() - t0) < 20_000) {
        console.log(`[D5-Index-v5] Below threshold (${seeds.length}<${MAP_THRESHOLD}), trying Map API...`);
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), MAP_TIMEOUT_MS);
          const mapResp = await fetch('https://api.firecrawl.dev/v1/map', {
            method: 'POST', signal: controller.signal,
            headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: INDEX_URL, search: 'university-show', limit: 5000 }),
          });
          clearTimeout(timer);
          const mapData = await mapResp.json();
          const mapLinks: string[] = mapData?.links || [];
          for (const link of mapLinks) {
            const m = link.match(/university-show\/(\d+)/);
            if (m && !existingIds.has(m[1])) {
              existingIds.add(m[1]);
              seeds.push({ name_en: '', sir_id: m[1], source_url: `${BASE_URL}/en/university-show/${m[1]}/about` });
              mapExtra++;
            }
          }
          console.log(`[D5-Index-v5] Map added ${mapExtra}, total: ${seeds.length}`);
        } catch (e) {
          mapSkipped = true;
          console.warn(`[D5-Index-v5] Map fallback skipped:`, String(e));
        }
      } else {
        console.log(`[D5-Index-v5] Skipping Map API (seeds=${seeds.length} >= threshold=${MAP_THRESHOLD})`);
      }

      // Enrich names from HTML <option> tags + markdown
      const enrichedHtml = html ? enrichSeedsFromHtml(seeds, html) : 0;
      const enrichedMd = markdown ? enrichSeedsFromMarkdown(seeds, markdown) : 0;
      console.log(`[D5-Index-v5] Enriched names: html=${enrichedHtml} md=${enrichedMd}`);

      // Dedupe final (safety)
      const deduped = new Map<string, SirSeed>();
      for (const s of seeds) {
        if (!deduped.has(s.sir_id) || (s.name_en && !deduped.get(s.sir_id)!.name_en)) {
          deduped.set(s.sir_id, s);
        }
      }
      seeds = Array.from(deduped.values());

      // Chunked upsert with PRESERVATION of existing matches
      const toUpsert = seeds.slice(0, limit);
      let upserted = 0, failed = 0, preservedMatches = 0, timeBudgetReached = false;

      for (let i = 0; i < toUpsert.length; i += UPSERT_CHUNK) {
        if (Date.now() - t0 > TIME_BUDGET_MS) {
          timeBudgetReached = true;
          console.log(`[D5-Index-v5] Time budget at chunk ${i}/${toUpsert.length}`);
          break;
        }
        const chunk = toUpsert.slice(i, i + UPSERT_CHUNK);
        
        // Fetch existing state to preserve matches
        const extIds = chunk.map(s => s.sir_id);
        const { data: existingRows } = await supabase
          .from('university_external_ids')
          .select('external_id, university_id, match_method, match_confidence')
          .eq('source_name', SOURCE_NAME)
          .in('external_id', extIds);
        
        const existMap = new Map<string, { university_id: string | null; match_method: string; match_confidence: number }>();
        for (const row of existingRows || []) {
          if (row.university_id) {
            existMap.set(row.external_id, row);
            preservedMatches++;
          }
        }

        const rows = chunk.map(s => {
          const prev = existMap.get(s.sir_id);
          return {
            source_name: SOURCE_NAME,
            external_id: s.sir_id,
            source_url: s.source_url,
            display_name: s.name_en || null,
            // CRITICAL: preserve existing match data
            university_id: prev?.university_id ?? null,
            match_method: prev?.match_method ?? 'unmatched',
            match_confidence: prev?.match_confidence ?? 0,
            is_primary_for_source: true,
            first_seen_at: startedAt,
            last_seen_at: startedAt,
            trace_id: traceId,
          };
        });
        const { error } = await supabase.from('university_external_ids').upsert(rows, {
          onConflict: 'source_name,external_id', ignoreDuplicates: false,
        });
        if (error) { console.error(`[D5-Index-v5] Upsert error chunk ${i}:`, error.message); failed++; }
        else upserted += chunk.length;
      }

      const namedCount = toUpsert.filter(s => s.name_en).length;

      // Count matches AFTER fetch (for verification)
      const { count: matchedAfter } = await supabase
        .from('university_external_ids')
        .select('*', { count: 'exact', head: true })
        .eq('source_name', SOURCE_NAME)
        .not('university_id', 'is', null);

      const telemetry = {
        trace_id: traceId, index_url: INDEX_URL,
        links_count: linksCount, option_extra: optionExtraCount, html_extra: htmlExtraCount, md_extra: mdExtraCount,
        map_extra: mapExtra, map_skipped: mapSkipped,
        seeds_total: seeds.length, deduped_total: deduped.size,
        attempted: toUpsert.length, upserted, failed,
        named_seeds: namedCount, preserved_matches_count: preservedMatches,
        matched_before: matchedBefore ?? 0, matched_after: matchedAfter ?? 0,
        time_budget_reached: timeBudgetReached,
        parser_version: PARSER_VERSION, elapsed_ms: Date.now() - t0,
      };

      console.log(`[D5-Index-v5] FETCH DONE:`, JSON.stringify(telemetry));

      await supabase.from('pipeline_health_events').insert({
        pipeline: 'door5', event_type: 'd5_index_fetch_done', batch_id: traceId,
        details_json: telemetry, created_at: new Date().toISOString(),
      });

      return new Response(JSON.stringify({ ...telemetry, phase }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ═══════════════════════════════════════════
    // PHASE: MATCH
    // ═══════════════════════════════════════════
    if (phase === 'match') {
      const { data: ruUnis, error: ruErr } = await supabase
        .from('universities')
        .select('id, name_en, name, slug')
        .eq('country_code', 'RU')
        .limit(500);
      
      if (ruErr || !ruUnis) {
        return new Response(JSON.stringify({ error: 'Failed to load RU universities: ' + ruErr?.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: aliasRows } = await supabase
        .from('university_aliases')
        .select('university_id, alias_normalized')
        .in('lang_code', ['en', 'en-US']);
      
      const aliasMap = new Map<string, string>();
      for (const a of aliasRows || []) {
        if (a.alias_normalized && a.university_id) {
          aliasMap.set(a.alias_normalized.toLowerCase(), a.university_id);
        }
      }
      console.log(`[D5-Index-v5] Loaded ${ruUnis.length} RU unis + ${aliasMap.size} aliases`);

      const rematchAll = (body as any)?.rematch_all === true;
      let query = supabase
        .from('university_external_ids')
        .select('external_id, source_url, display_name, university_id, match_method')
        .eq('source_name', SOURCE_NAME)
        .order('external_id');
      if (!rematchAll) {
        query = query.is('university_id', null);
      }
      if (cursorExternalId) {
        query = query.gt('external_id', cursorExternalId);
      }

      const { data: pendingSeeds, error: fetchErr } = await query.limit(limit);

      if (fetchErr || !pendingSeeds) {
        return new Response(JSON.stringify({ error: fetchErr?.message || 'no pending seeds' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      let matched = 0, unmatched = 0, skipped = 0, dbUpdated = 0, autoCreated = 0;
      const byMethod: Record<string, number> = {};
      const results: Array<{ sir_id: string; university_id: string | null; method: string; confidence: number; name?: string }> = [];

      console.log(`[D5-Index-v5] Match: ${pendingSeeds.length} pending, ${pendingSeeds.filter(s => s.display_name).length} named`);

      for (const seed of pendingSeeds) {
        if (Date.now() - t0 > TIME_BUDGET_MS) {
          console.log(`[D5-Index-v5] Time budget after ${results.length} seeds`);
          break;
        }
        const seedObj: SirSeed = {
          sir_id: seed.external_id!,
          source_url: seed.source_url!,
          name_en: seed.display_name || '',
        };
        try {
          let matchResult = await matchToExisting(supabase, seedObj, ruUnis, aliasMap);

          // Auto-create if unmatched and has name
          if (!matchResult.university_id && seedObj.name_en) {
            const slug = seedObj.name_en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            const { data: newUni, error: createErr } = await supabase
              .from('universities')
              .insert({
                name: seedObj.name_en, name_en: seedObj.name_en, slug,
                country_code: 'RU', country_id: '29932919-f891-40f4-b40a-8cb6f66708ef', is_active: false,
              })
              .select('id').single();
            if (newUni && !createErr) {
              matchResult = { university_id: newUni.id, method: 'auto_created', confidence: 1.0 };
              autoCreated++;
              ruUnis.push({ id: newUni.id, name_en: seedObj.name_en, name: seedObj.name_en, slug });
            } else if (createErr) {
              const slugRetry = `${slug}-sir-${seedObj.sir_id}`;
              const { data: retryUni } = await supabase
                .from('universities')
                .insert({
                  name: seedObj.name_en, name_en: seedObj.name_en, slug: slugRetry,
                  country_code: 'RU', country_id: '29932919-f891-40f4-b40a-8cb6f66708ef', is_active: false,
                })
                .select('id').single();
              if (retryUni) {
                matchResult = { university_id: retryUni.id, method: 'auto_created', confidence: 1.0 };
                autoCreated++;
                ruUnis.push({ id: retryUni.id, name_en: seedObj.name_en, name: seedObj.name_en, slug: slugRetry });
              } else {
                console.error(`[D5-Index-v5] Auto-create failed ${seedObj.name_en}:`, createErr.message);
              }
            }
          }

          const { error: updErr } = await supabase.from('university_external_ids').update({
            university_id: matchResult.university_id,
            match_method: matchResult.method,
            match_confidence: matchResult.confidence,
            last_seen_at: new Date().toISOString(),
            trace_id: traceId,
          }).eq('source_name', SOURCE_NAME).eq('external_id', seed.external_id!);

          if (updErr) {
            console.error(`[D5-Index-v5] Update error ${seed.external_id}:`, updErr.message);
            skipped++;
          } else {
            dbUpdated++;
            if (matchResult.university_id) matched++;
            else unmatched++;
            byMethod[matchResult.method] = (byMethod[matchResult.method] || 0) + 1;
          }
          results.push({
            sir_id: seed.external_id!, university_id: matchResult.university_id,
            method: matchResult.method, confidence: matchResult.confidence,
            name: seed.display_name || undefined,
          });
        } catch (err) {
          console.error(`[D5-Index-v5] Match error ${seed.external_id}:`, err);
          skipped++;
        }
      }

      const { count: totalMatchedCount } = await supabase
        .from('university_external_ids')
        .select('*', { count: 'exact', head: true })
        .eq('source_name', SOURCE_NAME)
        .not('university_id', 'is', null);

      const { count: totalUnmatchedCount } = await supabase
        .from('university_external_ids')
        .select('*', { count: 'exact', head: true })
        .eq('source_name', SOURCE_NAME)
        .is('university_id', null);

      const telemetry = {
        total_pending: pendingSeeds.length, processed: results.length,
        matched, unmatched, skipped, db_updated: dbUpdated, auto_created: autoCreated,
        by_method: byMethod,
        total_matched: totalMatchedCount ?? matched,
        total_unmatched: totalUnmatchedCount ?? unmatched,
        elapsed_ms: Date.now() - t0,
        time_budget_reached: Date.now() - t0 > TIME_BUDGET_MS,
        cursor_external_id: cursorExternalId,
      };

      console.log(`[D5-Index-v5] MATCH DONE:`, JSON.stringify(telemetry));

      await supabase.from('pipeline_health_events').insert({
        pipeline: 'door5', event_type: 'd5_index_match_done', batch_id: traceId,
        details_json: telemetry, created_at: new Date().toISOString(),
      });

      return new Response(JSON.stringify({
        trace_id: traceId, phase, ...telemetry,
        results: results.slice(0, 100),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: `Unknown phase: ${phase}. Use 'fetch' or 'match'.` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[D5-Index-v5] Fatal error:', err);
    return new Response(JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
