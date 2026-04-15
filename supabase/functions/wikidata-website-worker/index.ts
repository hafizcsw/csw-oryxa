/**
 * Wikidata Website Enrichment Worker v2
 * 
 * Uses Wikidata wbsearchentities API for fuzzy name matching,
 * then fetches P856 (official website) for matched entities.
 * Much better coverage than SPARQL exact-match approach.
 */
import { getSupabaseAdmin } from '../_shared/supabase.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-client-trace-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const WD_API = 'https://www.wikidata.org/w/api.php';
const USER_AGENT = 'CSW-UniversityEnrichment/1.0 (https://lavista-launchpad.lovable.app)';

function extractDomain(url: string): string | null {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Search Wikidata for a university by name, return entity IDs
 */
async function searchEntity(name: string): Promise<string[]> {
  const params = new URLSearchParams({
    action: 'wbsearchentities',
    search: name,
    language: 'en',
    type: 'item',
    limit: '5',
    format: 'json',
  });

  const res = await fetch(`${WD_API}?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!res.ok) {
    await res.text();
    return [];
  }

  const json = await res.json();
  return (json.search || []).map((r: any) => r.id);
}

/**
 * Fetch entity details (claims P31, P856, labels) for multiple entity IDs
 */
async function getEntities(ids: string[]): Promise<Record<string, any>> {
  if (ids.length === 0) return {};

  const params = new URLSearchParams({
    action: 'wbgetentities',
    ids: ids.join('|'),
    props: 'claims|labels|descriptions',
    languages: 'en|ar',
    format: 'json',
  });

  const res = await fetch(`${WD_API}?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!res.ok) {
    await res.text();
    return {};
  }

  const json = await res.json();
  return json.entities || {};
}

// Educational institution QIDs (P31 values that indicate a university)
const EDU_QIDS = new Set([
  'Q3918',    // university
  'Q38723',   // higher education institution
  'Q875538',  // public university
  'Q902104',  // private university
  'Q15936437', // research university
  'Q23002054', // vocational university
  'Q1188663',  // technical university
  'Q3354859',  // polytechnic
  'Q189004',   // college
  'Q2467461',  // university college
  'Q7894',     // academy
  'Q1371037',  // state university
  'Q3551775',  // open university
  'Q317074',   // federal university (Brazil)
  'Q62078547', // private higher education institution
  'Q1321960',  // community college
  'Q1419773',  // engineering school
  'Q1542661',  // business school
  'Q1065',     // United Nations University types
  'Q159334',   // institute of technology
  'Q1190554',  // school of art
  'Q1244442',  // institute
]);

/**
 * Check if entity is an educational institution
 */
function isEducational(entity: any): boolean {
  const p31Claims = entity?.claims?.P31 || [];
  for (const claim of p31Claims) {
    const qid = claim?.mainsnak?.datavalue?.value?.id;
    if (qid && EDU_QIDS.has(qid)) return true;
  }
  return false;
}

/**
 * Extract official website (P856) from entity
 */
function getWebsite(entity: any): string | null {
  const p856Claims = entity?.claims?.P856 || [];
  if (p856Claims.length === 0) return null;
  return p856Claims[0]?.mainsnak?.datavalue?.value || null;
}

function getLabel(entity: any): string {
  return entity?.labels?.en?.value || entity?.labels?.ar?.value || '';
}

function getDescription(entity: any): string {
  return entity?.descriptions?.en?.value || entity?.descriptions?.ar?.value || '';
}

/**
 * Score match quality
 */
function scoreMatch(ourName: string, wdLabel: string): number {
  const a = ourName.toLowerCase().trim();
  const b = wdLabel.toLowerCase().trim();
  if (a === b) return 95;
  if (a.includes(b) || b.includes(a)) return 80;
  
  const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 2));
  const intersection = [...wordsA].filter(w => wordsB.has(w));
  const union = new Set([...wordsA, ...wordsB]);
  return Math.round((intersection.length / union.size) * 100);
}

/**
 * Process a single university: search → fetch entities → find best match with website
 */
async function processUniversity(name: string): Promise<{
  website: string | null;
  entityId: string;
  label: string;
  description: string;
  confidence: number;
} | null> {
  // Step 1: Search for entity IDs
  const entityIds = await searchEntity(name);
  if (entityIds.length === 0) return null;

  // Step 2: Fetch entity details
  const entities = await getEntities(entityIds);

  // Step 3: Find best educational entity with a website
  let best: { website: string; entityId: string; label: string; description: string; confidence: number } | null = null;

  for (const [id, entity] of Object.entries(entities)) {
    if (!isEducational(entity)) continue;
    const website = getWebsite(entity);
    if (!website) continue;
    
    const label = getLabel(entity);
    const confidence = scoreMatch(name, label);
    
    if (!best || confidence > best.confidence) {
      best = { website, entityId: id, label, description: getDescription(entity), confidence };
    }
  }

  return best;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getSupabaseAdmin();

  try {
    const body = await req.json().catch(() => ({}));
    const { job_id, batch_size = 15 } = body;

    if (!job_id) {
      return new Response(
        JSON.stringify({ ok: false, error: 'job_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch pending rows
    const { data: rows, error: fetchErr } = await supabase
      .from('website_enrichment_rows')
      .select('id, university_id, university_name, country_code, city')
      .eq('job_id', job_id)
      .eq('enrichment_status', 'pending')
      .order('id')
      .limit(batch_size);

    if (fetchErr) {
      return new Response(
        JSON.stringify({ ok: false, error: fetchErr.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, processed: 0, matched: 0, failed: 0, done: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark as processing
    const rowIds = rows.map(r => r.id);
    await supabase
      .from('website_enrichment_rows')
      .update({ enrichment_status: 'processing', updated_at: new Date().toISOString() })
      .in('id', rowIds);

    let matched = 0;
    let failed = 0;

    // Process universities in parallel (5 at a time to respect Wikidata rate limits)
    const CONCURRENCY = 5;
    for (let i = 0; i < rows.length; i += CONCURRENCY) {
      const chunk = rows.slice(i, i + CONCURRENCY);
      
      const results = await Promise.allSettled(
        chunk.map(async (row) => {
          const name = row.university_name || '';
          if (!name) return { row, match: null };
          
          try {
            const match = await processUniversity(name);
            return { row, match };
          } catch (err) {
            console.error(`[wikidata] Error for "${name}":`, err);
            return { row, match: null, error: String(err) };
          }
        })
      );

      for (const result of results) {
        if (result.status === 'rejected') continue;
        const { row, match, error } = result.value as any;

        if (match && match.confidence >= 50) {
          const domain = extractDomain(match.website);
          const needsReview = match.confidence < 75;

          await supabase
            .from('website_enrichment_rows')
            .update({
              enrichment_status: needsReview ? 'review' : 'matched',
              official_website_url: match.website,
              official_website_domain: domain,
              match_source: 'wikidata',
              confidence_score: match.confidence,
              match_reason: `Wikidata ${match.entityId}: "${match.label}"`,
              matched_entity_name: match.label,
              needs_manual_review: needsReview,
              raw_provider_response: {
                entity_id: match.entityId,
                description: match.description,
                url: match.website,
              },
              attempt_count: 1,
              enriched_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', row.id);
          matched++;
        } else {
          await supabase
            .from('website_enrichment_rows')
            .update({
              enrichment_status: 'failed',
              last_error: error || 'No Wikidata match found',
              match_source: 'wikidata',
              attempt_count: 1,
              updated_at: new Date().toISOString(),
            })
            .eq('id', row.id);
          failed++;
        }
      }

      // Small delay between chunks to respect Wikidata rate limits
      if (i + CONCURRENCY < rows.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    // Update last activity
    await supabase
      .from('website_enrichment_jobs')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', job_id);

    // Check remaining
    const { count: remaining } = await supabase
      .from('website_enrichment_rows')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', job_id)
      .eq('enrichment_status', 'pending');

    return new Response(
      JSON.stringify({
        ok: true,
        processed: rows.length,
        matched,
        failed,
        remaining: remaining || 0,
        done: (remaining || 0) === 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[wikidata-worker] Fatal:', err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
