import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================
// QS Page-Order Acquisition — Revision 2.1
// Phase A: Acquire entries from QS ranking pages
// Phase B: Profile crawl for acquired entries
// ============================================================

const QS_BASE_URL = 'https://www.topuniversities.com/world-university-rankings';
const QS_YEAR = '2026';
const PROFILE_URL_PREFIX = '/universities/';
const FULL_PROFILE_PREFIX = 'https://www.topuniversities.com/universities/';

// ── Parser Contract ──────────────────────────────────────────

interface ParsedEntry {
  rank_raw: string;
  rank_normalized: number | null;
  display_name: string;
  source_profile_url: string;
  qs_slug: string;
  overall_score: string | null;
  location: string | null;
}

function normalizeRank(raw: string): number | null {
  if (!raw) return null;
  // Remove = prefix for tied ranks
  const cleaned = raw.replace(/^=/, '').trim();
  // Handle ranges like "801-1000" → take first number
  const rangeMatch = cleaned.match(/^(\d+)/);
  if (!rangeMatch) return null;
  const num = parseInt(rangeMatch[1], 10);
  // Guard: reject if looks like a year (2020-2035)
  if (num >= 2020 && num <= 2035) return null;
  return isNaN(num) ? null : num;
}

function isValidProfileUrl(url: string): boolean {
  if (!url) return false;
  // Must contain /universities/{slug}
  const match = url.match(/\/universities\/([a-z0-9][a-z0-9\-]*[a-z0-9])$/i);
  if (!match) return false;
  const slug = match[1].toLowerCase();
  // Reject known non-profile paths
  const rejected = ['search', 'ranking', 'compare', 'rankings', 'find'];
  if (rejected.some(r => slug === r || slug.startsWith(r + '-'))) return false;
  return true;
}

function extractSlugFromUrl(url: string): string | null {
  const match = url.match(/\/universities\/([a-z0-9\-]+)/i);
  return match ? match[1].toLowerCase() : null;
}

function parseMarkdownEntries(markdown: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const lines = markdown.split('\n');

  for (let i = 0; i < lines.length; i++) {
    // Look for pattern: "Rank\n{number}\n"
    if (lines[i].trim() !== 'Rank') continue;

    // Next non-empty line should be the rank number
    let rankLine = '';
    let j = i + 1;
    while (j < lines.length && !lines[j].trim()) j++;
    if (j >= lines.length) continue;
    rankLine = lines[j].trim();

    // Validate rank_raw matches expected pattern
    if (!/^\=?\d+[\-\+]?\d*$/.test(rankLine)) continue;

    // Find Overall Score
    let overallScore: string | null = null;
    let profileUrl = '';
    let displayName = '';
    let location: string | null = null;

    // Scan forward for profile link and score (within ~30 lines)
    for (let k = j + 1; k < Math.min(j + 30, lines.length); k++) {
      const line = lines[k];

      // Overall Score pattern: "Overall Score:99.4"
      const scoreMatch = line.match(/Overall Score:([\d.]+)/);
      if (scoreMatch) {
        overallScore = scoreMatch[1];
      }

      // Profile URL pattern: [![Name](img)](profile_url)[Name](profile_url)
      // or just [Name](profile_url)
      const profileMatch = line.match(/\]\(https:\/\/www\.topuniversities\.com\/universities\/([a-z0-9\-]+)\)/i);
      if (profileMatch && !profileUrl) {
        const slug = profileMatch[1].toLowerCase();
        profileUrl = `https://www.topuniversities.com/universities/${slug}`;
        // Extract display name: [Name]( ... )
        const nameMatch = line.match(/\[([^\]]+)\]\(https:\/\/www\.topuniversities\.com\/universities\//);
        if (nameMatch) {
          // Clean display name - remove any image markdown
          displayName = nameMatch[1].replace(/!\[.*?\]\(.*?\)/g, '').trim();
        }
      }

      // Location pattern: "![location](...) City, Country"
      const locMatch = line.match(/location\.svg\)\s*(.+)/);
      if (locMatch) {
        location = locMatch[1].trim();
      }

      // Stop when we hit the next "Rank" marker or "In order to see the data"
      if (k > j + 5 && lines[k].trim() === 'Rank') break;
      if (line.includes('In order to see the data')) break;
    }

    if (!profileUrl || !displayName || !rankLine) continue;

    const slug = extractSlugFromUrl(profileUrl);
    if (!slug) continue;
    if (!isValidProfileUrl(profileUrl)) continue;

    entries.push({
      rank_raw: rankLine,
      rank_normalized: normalizeRank(rankLine),
      display_name: displayName,
      source_profile_url: profileUrl,
      qs_slug: slug,
      overall_score: overallScore,
      location: location,
    });
  }

  return entries;
}

// ── Page Shell Guardrail ─────────────────────────────────────

interface GuardrailResult {
  is_valid: boolean;
  shell_reason: string | null;
  has_next_page: boolean;
  valid_rank_count: number;
  markdown_length: number;
  entry_count: number;
  parse_warnings: string[];
}

function applyPageShellGuardrail(
  markdown: string,
  entries: ParsedEntry[],
  pageNumber: number
): GuardrailResult {
  const markdownLength = markdown.length;
  const entryCount = entries.length;
  const validRankCount = entries.filter(e => e.rank_normalized !== null).length;

  // Check for next page link
  const nextPagePattern = new RegExp(`#page-${pageNumber + 1}|page=${pageNumber + 1}`, 'i');
  const hasNextPage = nextPagePattern.test(markdown);

  // Check title contains ranking/2026
  const hasRankingTitle = /Rankings?\s*2026|QS World University/i.test(markdown);

  // Shell checks
  if (markdownLength < 500) {
    return { is_valid: false, shell_reason: 'markdown_too_short', has_next_page: hasNextPage, valid_rank_count: validRankCount, markdown_length: markdownLength, entry_count: entryCount, parse_warnings: [] };
  }
  // Terminal page exception: short page at end of rankings is valid
  if (entryCount < 5 && entryCount > 0 && !hasNextPage && validRankCount >= 1) {
    return { is_valid: true, shell_reason: null, has_next_page: false, valid_rank_count: validRankCount, markdown_length: markdownLength, entry_count: entryCount, parse_warnings: ['terminal_short_page_accepted'] };
  }
  if (entryCount < 5) {
    return { is_valid: false, shell_reason: `too_few_entries:${entryCount}`, has_next_page: hasNextPage, valid_rank_count: validRankCount, markdown_length: markdownLength, entry_count: entryCount, parse_warnings: [] };
  }
  if (validRankCount < entryCount * 0.8) {
    return { is_valid: false, shell_reason: `low_valid_rank_ratio:${validRankCount}/${entryCount}`, has_next_page: hasNextPage, valid_rank_count: validRankCount, markdown_length: markdownLength, entry_count: entryCount, parse_warnings: [] };
  }
  if (!hasRankingTitle) {
    return { is_valid: false, shell_reason: 'missing_ranking_title', has_next_page: hasNextPage, valid_rank_count: validRankCount, markdown_length: markdownLength, entry_count: entryCount, parse_warnings: [] };
  }

  return { is_valid: true, shell_reason: null, has_next_page: hasNextPage, valid_rank_count: validRankCount, markdown_length: markdownLength, entry_count: entryCount, parse_warnings: [] };
}

// ── Main Handler ─────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ ok: false, error: 'method_not_allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const traceId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // Auth: require service role or admin
    const authHeader = req.headers.get('authorization');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SRV_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const FIRECRAWL_KEY = Deno.env.get('FIRECRAWL_API_KEY');

    if (!FIRECRAWL_KEY) {
      return new Response(
        JSON.stringify({ ok: false, error: 'FIRECRAWL_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const srv = createClient(SUPABASE_URL, SRV_KEY);

    // Check if called with service role key directly
    const isServiceCall = authHeader === `Bearer ${SRV_KEY}`;
    if (!isServiceCall) {
      // Verify admin
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ ok: false, error: 'unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const authClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user }, error: authErr } = await authClient.auth.getUser();
      if (authErr || !user) {
        return new Response(
          JSON.stringify({ ok: false, error: 'unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const { data: isAdmin } = await srv.rpc('is_admin', { _user_id: user.id });
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ ok: false, error: 'forbidden' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Parse request
    const body = await req.json().catch(() => ({})) as {
      action?: 'acquire_page' | 'profile_crawl';
      page_number?: number;
      run_id?: string;
      profile_batch_size?: number;
    };

    const action = body.action || 'acquire_page';
    const runId = body.run_id || `acq_${Date.now()}`;

    if (action === 'acquire_page') {
      return await handleAcquirePage(srv, body.page_number || 1, runId, traceId, startTime, FIRECRAWL_KEY);
    } else if (action === 'profile_crawl') {
      return await handleProfileCrawl(srv, runId, traceId, body.profile_batch_size || 5, FIRECRAWL_KEY);
    } else {
      return new Response(
        JSON.stringify({ ok: false, error: `unknown action: ${action}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('[qs-page-acquisition] Error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error), trace_id: traceId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ── Phase A: Acquire Page ────────────────────────────────────

async function handleAcquirePage(
  srv: any,
  pageNumber: number,
  runId: string,
  traceId: string,
  startTime: number,
  firecrawlKey: string
) {
  console.log(`[qs-page-acquisition] Phase A: acquiring page ${pageNumber}, run=${runId}, trace=${traceId}`);

  // Construct page URL
  const pageUrl = pageNumber === 1
    ? QS_BASE_URL
    : `${QS_BASE_URL}?page=${pageNumber}`;

  // Scrape via Firecrawl
  const scrapeStart = Date.now();
  const scrapeRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${firecrawlKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: pageUrl,
      formats: ['markdown'],
      waitFor: 5000, // Wait for JS rendering
    }),
  });

  const scrapeData = await scrapeRes.json();
  const scrapeDuration = Date.now() - scrapeStart;

  if (!scrapeRes.ok || !scrapeData.success) {
    console.error('[qs-page-acquisition] Firecrawl error:', scrapeData);

    // Save failed proof
    await srv.from('qs_page_proofs').insert({
      page_number: pageNumber,
      page_url: pageUrl,
      entry_count: 0,
      valid_rank_count: 0,
      markdown_length: 0,
      has_next_page: false,
      is_valid: false,
      shell_reason: `firecrawl_error:${scrapeData.error || scrapeRes.status}`,
      parse_warnings: [`Firecrawl returned ${scrapeRes.status}`],
      acquisition_run_id: runId,
      trace_id: traceId,
      fetch_duration_ms: scrapeDuration,
    });

    return new Response(
      JSON.stringify({ ok: false, error: 'firecrawl_failed', details: scrapeData.error, trace_id: traceId }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const markdown = scrapeData.data?.markdown || scrapeData.markdown || '';
  console.log(`[qs-page-acquisition] Got markdown: ${markdown.length} chars`);

  // Save raw snapshot (crawl_raw_snapshots schema: source, source_url, raw_markdown, fetch_method, fetched_at, metadata)
  const { data: snapshot, error: snapErr } = await srv.from('crawl_raw_snapshots').insert({
    source: 'qs_rankings_page',
    source_url: pageUrl,
    raw_markdown: markdown,
    fetch_method: 'firecrawl',
    fetched_at: new Date().toISOString(),
    metadata: { trace_id: traceId, markdown_length: markdown.length, run_id: runId },
  }).select('id').single();
  if (snapErr) console.error('[qs-page-acquisition] Snapshot insert error:', snapErr);

  const snapshotId = snapshot?.id || null;

  // Parse entries
  const entries = parseMarkdownEntries(markdown);
  console.log(`[qs-page-acquisition] Parsed ${entries.length} entries from page ${pageNumber}`);

  // Apply page-shell guardrail
  const guardrail = applyPageShellGuardrail(markdown, entries, pageNumber);

  // Calculate global_position for each entry
  const parseWarnings: string[] = [];
  const processedEntries = entries.map((entry, idx) => {
    const positionOnPage = idx + 1;
    let globalPosition: number;
    let rankSource: string;

    if (entry.rank_normalized !== null) {
      globalPosition = entry.rank_normalized;
      rankSource = 'extracted';
    } else {
      // Fallback: use first entry's rank + position offset
      const firstRank = entries[0]?.rank_normalized;
      if (firstRank !== null && firstRank !== undefined) {
        globalPosition = firstRank + idx;
      } else {
        globalPosition = (pageNumber - 1) * entries.length + positionOnPage;
      }
      rankSource = 'fallback_position';
      parseWarnings.push(`entry_${positionOnPage}_rank_fallback:${entry.rank_raw}`);
    }

    return {
      source: 'qs_rankings',
      page_number: pageNumber,
      position_on_page: positionOnPage,
      global_position: globalPosition,
      rank_raw: entry.rank_raw,
      rank_normalized: entry.rank_normalized,
      rank_source: rankSource,
      qs_slug: entry.qs_slug,
      display_name: entry.display_name,
      source_profile_url: entry.source_profile_url,
      entity_type: 'university',
      crawl_status: 'discovered',
      results_per_page_observed: entries.length,
      discovery_method: 'page_scrape',
      acquisition_run_id: runId,
      trace_id: traceId,
    };
  });

  // Insert entries with dedup
  let insertedCount = 0;
  let duplicateCount = 0;
  const duplicateSlugs: string[] = [];

  for (const entry of processedEntries) {
    const { error } = await srv.from('qs_page_entries').insert(entry);
    if (error) {
      if (error.code === '23505') { // unique violation
        duplicateCount++;
        duplicateSlugs.push(entry.qs_slug);
        // Update last_seen_at for existing entry
        await srv.from('qs_page_entries')
          .update({
            last_seen_at: new Date().toISOString(),
            is_duplicate_seen: true,
          })
          .eq('qs_slug', entry.qs_slug);
      } else {
        console.error(`[qs-page-acquisition] Insert error for ${entry.qs_slug}:`, error);
        parseWarnings.push(`insert_error:${entry.qs_slug}:${error.message}`);
      }
    } else {
      insertedCount++;
    }
  }

  // Save page proof
  const firstEntry = entries[0];
  const lastEntry = entries[entries.length - 1];

  await srv.from('qs_page_proofs').insert({
    page_number: pageNumber,
    page_url: pageUrl,
    snapshot_id: snapshotId,
    entry_count: entries.length,
    first_slug: firstEntry?.qs_slug || null,
    last_slug: lastEntry?.qs_slug || null,
    first_rank_raw: firstEntry?.rank_raw || null,
    last_rank_raw: lastEntry?.rank_raw || null,
    first_rank_normalized: firstEntry?.rank_normalized || null,
    last_rank_normalized: lastEntry?.rank_normalized || null,
    results_per_page_observed: entries.length,
    valid_rank_count: guardrail.valid_rank_count,
    markdown_length: guardrail.markdown_length,
    has_next_page: guardrail.has_next_page,
    is_valid: guardrail.is_valid,
    shell_reason: guardrail.shell_reason,
    parse_warnings: parseWarnings.length > 0 ? parseWarnings : null,
    acquisition_run_id: runId,
    trace_id: traceId,
    fetch_duration_ms: scrapeDuration,
  });

  // Update cursor
  await srv.from('qs_acquisition_cursor')
    .update({
      run_id: runId,
      phase: 'acquisition',
      status: guardrail.is_valid ? 'running' : 'error',
      current_page: guardrail.is_valid ? pageNumber : pageNumber - 1,
      total_entries: insertedCount,
      last_tick_at: new Date().toISOString(),
      consecutive_errors: guardrail.is_valid ? 0 : 1,
      log: [`page_${pageNumber}: ${entries.length} entries, ${insertedCount} inserted, ${duplicateCount} dupes, valid=${guardrail.is_valid}`],
    })
    .eq('id', 'qs_acq');

  const result = {
    ok: guardrail.is_valid,
    trace_id: traceId,
    acquisition_run_id: runId,
    page_number: pageNumber,
    page_url: pageUrl,
    entry_count: entries.length,
    inserted_count: insertedCount,
    duplicate_count: duplicateCount,
    duplicate_slugs: duplicateSlugs,
    valid_rank_count: guardrail.valid_rank_count,
    results_per_page_observed: entries.length,
    first_slug: firstEntry?.qs_slug,
    last_slug: lastEntry?.qs_slug,
    first_rank_raw: firstEntry?.rank_raw,
    last_rank_raw: lastEntry?.rank_raw,
    is_valid: guardrail.is_valid,
    shell_reason: guardrail.shell_reason,
    has_next_page: guardrail.has_next_page,
    snapshot_id: snapshotId,
    markdown_length: guardrail.markdown_length,
    fetch_duration_ms: scrapeDuration,
    total_duration_ms: Date.now() - startTime,
  };

  console.log('[qs-page-acquisition] Result:', JSON.stringify(result));

  return new Response(
    JSON.stringify(result),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ── Phase B: Profile Crawl ───────────────────────────────────

async function handleProfileCrawl(
  srv: any,
  runId: string,
  traceId: string,
  batchSize: number,
  firecrawlKey: string
) {
  console.log(`[qs-page-acquisition] Phase B: profile crawl, run=${runId}, batch=${batchSize}, trace=${traceId}`);

  // Get entries ready for profile crawl (in sort_position order for deterministic tie-breaking)
  const { data: entries, error: fetchErr } = await srv
    .from('qs_page_entries')
    .select('id, qs_slug, source_profile_url, global_position, sort_position, profile_attempts')
    .eq('crawl_status', 'profile_pending')
    .order('sort_position', { ascending: true })
    .limit(batchSize);

  if (fetchErr || !entries || entries.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, message: 'no_entries_pending', trace_id: traceId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log(`[qs-page-acquisition] Processing ${entries.length} profiles`);

  const results: any[] = [];

  for (const entry of entries) {
    // Mark as fetching
    await srv.from('qs_page_entries')
      .update({ crawl_status: 'profile_fetching', profile_run_id: runId })
      .eq('id', entry.id);

    try {
      const scrapeRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: entry.source_profile_url,
          formats: ['markdown'],
          waitFor: 5000,
        }),
      });

      const scrapeData = await scrapeRes.json();

      if (!scrapeRes.ok || !scrapeData.success) {
        const attempts = (entry.profile_attempts || 0) + 1;
        const nextStatus = attempts >= 3 ? 'profile_failed' : 'profile_pending';
        await srv.from('qs_page_entries')
          .update({
            crawl_status: nextStatus,
            profile_error: scrapeData.error || `HTTP ${scrapeRes.status}`,
            profile_attempts: attempts,
          })
          .eq('id', entry.id);

        results.push({
          qs_slug: entry.qs_slug,
          status: nextStatus,
          error: scrapeData.error || `HTTP ${scrapeRes.status}`,
        });
        continue;
      }

      const profileMarkdown = scrapeData.data?.markdown || scrapeData.markdown || '';

      // Shell check on profile: must have meaningful content
      const isProfileShell = profileMarkdown.length < 300 ||
        /University Directory Search|Search Results/i.test(profileMarkdown);

      // Save snapshot (correct column names for crawl_raw_snapshots)
      const { data: profileSnap, error: snapErr2 } = await srv.from('crawl_raw_snapshots').insert({
        source: 'qs_profile',
        source_url: entry.source_profile_url,
        raw_markdown: profileMarkdown,
        fetch_method: 'firecrawl',
        fetched_at: new Date().toISOString(),
        metadata: { trace_id: traceId, markdown_length: profileMarkdown.length, qs_slug: entry.qs_slug },
      }).select('id').single();
      if (snapErr2) console.error(`[qs-page-acquisition] Profile snapshot error for ${entry.qs_slug}:`, snapErr2);

      const newStatus = isProfileShell ? 'profile_failed' : 'profile_done';
      await srv.from('qs_page_entries')
        .update({
          crawl_status: newStatus,
          profile_snapshot_id: profileSnap?.id || null,
          profile_fetched_at: new Date().toISOString(),
          profile_attempts: (entry.profile_attempts || 0) + 1,
          profile_error: isProfileShell ? 'shell_profile_detected' : null,
          profile_run_id: runId,
        })
        .eq('id', entry.id);

      results.push({
        qs_slug: entry.qs_slug,
        status: newStatus,
        profile_snapshot_id: profileSnap?.id,
        markdown_length: profileMarkdown.length,
        is_shell: isProfileShell,
      });

    } catch (err) {
      const attempts = (entry.profile_attempts || 0) + 1;
      await srv.from('qs_page_entries')
        .update({
          crawl_status: attempts >= 3 ? 'profile_failed' : 'profile_pending',
          profile_error: String(err),
          profile_attempts: attempts,
        })
        .eq('id', entry.id);

      results.push({
        qs_slug: entry.qs_slug,
        status: 'error',
        error: String(err),
      });
    }
  }

  // Update cursor
  await srv.from('qs_acquisition_cursor')
    .update({
      phase: 'profile_crawl',
      last_tick_at: new Date().toISOString(),
    })
    .eq('id', 'qs_acq');

  return new Response(
    JSON.stringify({
      ok: true,
      trace_id: traceId,
      profile_run_id: runId,
      processed: results.length,
      results,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
