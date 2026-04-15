import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// QS 2026 Full End-to-End Pipeline
// Phases: acquisition → profile_crawl → extraction → programme_discovery → programme_crawl → programme_extraction → completed
// Runs autonomously via pg_cron every 30s
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_PAGES = 55;
const MAX_CONSECUTIVE_ERRORS = 3;
const PROFILE_BATCH_SIZE = 3;
const EXTRACT_BATCH_SIZE = 10;
const PROGRAMME_CRAWL_BATCH = 3;
const TIME_BUDGET_MS = 55_000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const traceId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SRV_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('authorization');
    const srv = createClient(SUPABASE_URL, SRV_KEY);
    const isServiceCall = authHeader === `Bearer ${SRV_KEY}`;
    const isCronCall = authHeader === `Bearer ${ANON_KEY}`;
    if (!isServiceCall && !isCronCall) {
      if (!authHeader?.startsWith('Bearer ')) return json({ ok: false, error: 'unauthorized' }, 401);
      const authClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error: authErr } = await authClient.auth.getUser();
      if (authErr || !user) return json({ ok: false, error: 'unauthorized' }, 401);
      const { data: isAdmin } = await srv.rpc('is_admin', { _user_id: user.id });
      if (!isAdmin) return json({ ok: false, error: 'forbidden' }, 403);
    }

    const body = await req.json().catch(() => ({})) as { action?: string; run_id?: string };
    const action = body.action || 'tick';

    if (action === 'start') return await handleStart(srv, traceId);
    if (action === 'status') return await handleStatus(srv);
    return await handleTick(srv, traceId, startTime);

  } catch (error) {
    console.error('[qs-orchestrator] Error:', error);
    return json({ ok: false, error: String(error), trace_id: traceId }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ── START ─────────────────────────────────────────────
async function handleStart(srv: any, traceId: string) {
  const { data: cursor } = await srv.from('qs_acquisition_cursor').select('*').eq('id', 'qs_acq').single();
  if (cursor?.status === 'running') return json({ ok: false, error: 'crawl_already_running', phase: cursor.phase, current_page: cursor.current_page });

  const runId = `qs_full_${Date.now()}`;
  await srv.from('qs_acquisition_cursor').update({
    run_id: runId, phase: 'acquisition', status: 'running', current_page: 1, total_entries: 30,
    last_tick_at: new Date().toISOString(), consecutive_errors: 0,
    log: [`started full crawl run ${runId}`],
  }).eq('id', 'qs_acq');

  return json({ ok: true, run_id: runId, trace_id: traceId });
}

// ── STATUS ────────────────────────────────────────────
async function handleStatus(srv: any) {
  const { data: cursor } = await srv.from('qs_acquisition_cursor').select('*').eq('id', 'qs_acq').single();
  const counts = await getCounts(srv);
  return json({ ok: true, cursor, counts });
}

async function getCounts(srv: any) {
  const q = async (status: string) => {
    const { count } = await srv.from('qs_page_entries').select('id', { head: true, count: 'exact' }).eq('crawl_status', status);
    return count || 0;
  };
  const { count: totalEntries } = await srv.from('qs_page_entries').select('id', { head: true, count: 'exact' });
  const { count: entityProfiles } = await srv.from('qs_entity_profiles').select('id', { head: true, count: 'exact' });
  const { count: rankingRows } = await srv.from('qs_ranking_snapshots').select('id', { head: true, count: 'exact' });
  const { count: progEntries } = await srv.from('qs_programme_entries').select('id', { head: true, count: 'exact' });
  const { count: progDetails } = await srv.from('qs_programme_details').select('id', { head: true, count: 'exact' });
  const { count: progPending } = await srv.from('qs_programme_entries').select('id', { head: true, count: 'exact' }).eq('crawl_status', 'discovered');
  const { count: progDone } = await srv.from('qs_programme_entries').select('id', { head: true, count: 'exact' }).eq('crawl_status', 'profile_done');

  return {
    total_entries: totalEntries || 0,
    profile_pending: await q('profile_pending'),
    profile_done: await q('profile_done'),
    profile_failed: await q('profile_failed'),
    extraction_pending: await q('extraction_pending'),
    extracted: await q('extracted'),
    entity_profiles: entityProfiles || 0,
    ranking_rows: rankingRows || 0,
    programmes_discovered: progEntries || 0,
    programmes_crawled: progDone || 0,
    programmes_pending: progPending || 0,
    programmes_extracted: progDetails || 0,
  };
}

// ── TICK ──────────────────────────────────────────────
async function handleTick(srv: any, traceId: string, startTime: number) {
  const { data: cursor } = await srv.from('qs_acquisition_cursor').select('*').eq('id', 'qs_acq').single();
  if (!cursor || cursor.status !== 'running') return json({ ok: true, message: 'not_running', cursor });

  const runId = cursor.run_id;
  const phase = cursor.phase;

  if (phase === 'acquisition') return await tickAcquisition(srv, cursor, runId, traceId, startTime);
  if (phase === 'profile_crawl') return await tickProfileCrawl(srv, cursor, runId, traceId, startTime);
  if (phase === 'extraction') return await tickExtraction(srv, cursor, runId, traceId, startTime);
  if (phase === 'programme_discovery') return await tickProgrammeDiscovery(srv, cursor, runId, traceId, startTime);
  if (phase === 'programme_crawl') return await tickProgrammeCrawl(srv, cursor, runId, traceId, startTime);
  if (phase === 'programme_extraction') return await tickProgrammeExtraction(srv, cursor, runId, traceId, startTime);
  if (phase === 'completed') return json({ ok: true, message: 'crawl_completed', cursor });

  return json({ ok: true, message: 'unknown_phase', cursor });
}

// ── Phase A: Acquisition ─────────────────────────────
async function tickAcquisition(srv: any, cursor: any, runId: string, traceId: string, startTime: number) {
  const nextPage = (cursor.current_page || 1) + 1;
  if (nextPage > MAX_PAGES) { await transitionPhase(srv, cursor, 'profile_crawl'); return json({ ok: true, message: 'acquisition_complete' }); }

  const FIRECRAWL_KEY = Deno.env.get('FIRECRAWL_API_KEY');
  if (!FIRECRAWL_KEY) return json({ ok: false, error: 'FIRECRAWL_API_KEY not configured' }, 500);

  const pageUrl = `https://www.topuniversities.com/world-university-rankings?page=${nextPage}`;
  const scrapeStart = Date.now();
  let scrapeData: any, scrapeOk = false;

  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${FIRECRAWL_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: pageUrl, formats: ['markdown'], waitFor: 5000 }),
    });
    scrapeData = await res.json();
    scrapeOk = res.ok && scrapeData.success;
  } catch (err) { scrapeData = { error: String(err) }; }

  const scrapeDuration = Date.now() - scrapeStart;

  if (!scrapeOk) {
    const consErrors = (cursor.consecutive_errors || 0) + 1;
    await srv.from('qs_page_proofs').insert({ page_number: nextPage, page_url: pageUrl, entry_count: 0, valid_rank_count: 0, markdown_length: 0, has_next_page: false, is_valid: false, shell_reason: `firecrawl_error:${scrapeData?.error || 'unknown'}`, acquisition_run_id: runId, trace_id: traceId, fetch_duration_ms: scrapeDuration });
    if (consErrors >= MAX_CONSECUTIVE_ERRORS) {
      await srv.from('qs_acquisition_cursor').update({ status: 'halted', consecutive_errors: consErrors, last_tick_at: new Date().toISOString() }).eq('id', 'qs_acq');
      return json({ ok: false, error: 'halted_consecutive_errors', page: nextPage });
    }
    await srv.from('qs_acquisition_cursor').update({ consecutive_errors: consErrors, last_tick_at: new Date().toISOString() }).eq('id', 'qs_acq');
    return json({ ok: false, error: 'page_fetch_failed', page: nextPage, will_retry: true });
  }

  const markdown = scrapeData.data?.markdown || scrapeData.markdown || '';
  const { data: snapshot } = await srv.from('crawl_raw_snapshots').insert({ source: 'qs_rankings_page', source_url: pageUrl, raw_markdown: markdown, fetch_method: 'firecrawl', fetched_at: new Date().toISOString(), metadata: { trace_id: traceId, markdown_length: markdown.length, run_id: runId, page: nextPage } }).select('id').single();

  const entries = parseMarkdownEntries(markdown);
  const guardrail = applyGuardrail(markdown, entries, nextPage);

  if (!guardrail.is_valid) {
    if (entries.length === 0 && !guardrail.has_next_page) {
      await srv.from('qs_page_proofs').insert({ page_number: nextPage, page_url: pageUrl, snapshot_id: snapshot?.id, entry_count: 0, valid_rank_count: 0, markdown_length: markdown.length, has_next_page: false, is_valid: false, shell_reason: 'end_of_rankings', acquisition_run_id: runId, trace_id: traceId, fetch_duration_ms: scrapeDuration });
      await transitionPhase(srv, cursor, 'profile_crawl');
      return json({ ok: true, message: 'acquisition_complete_no_more_pages', last_page: nextPage - 1 });
    }
    const consErrors = (cursor.consecutive_errors || 0) + 1;
    await srv.from('qs_page_proofs').insert({ page_number: nextPage, page_url: pageUrl, snapshot_id: snapshot?.id, entry_count: entries.length, valid_rank_count: guardrail.valid_rank_count, markdown_length: markdown.length, has_next_page: guardrail.has_next_page, is_valid: false, shell_reason: guardrail.shell_reason, acquisition_run_id: runId, trace_id: traceId, fetch_duration_ms: scrapeDuration });
    if (consErrors >= MAX_CONSECUTIVE_ERRORS) {
      await srv.from('qs_acquisition_cursor').update({ status: 'halted', consecutive_errors: consErrors, last_tick_at: new Date().toISOString() }).eq('id', 'qs_acq');
      return json({ ok: false, error: 'halted_shell_pages', page: nextPage });
    }
    await srv.from('qs_acquisition_cursor').update({ consecutive_errors: consErrors, last_tick_at: new Date().toISOString() }).eq('id', 'qs_acq');
    return json({ ok: false, error: 'shell_page', page: nextPage, will_retry: true });
  }

  // Insert entries
  let insertedCount = 0, duplicateCount = 0;
  const { data: maxSortRow } = await srv.from('qs_page_entries').select('sort_position').order('sort_position', { ascending: false, nullsFirst: false }).limit(1).single();
  let nextSortPosition = (maxSortRow?.sort_position || 0) + 1;

  for (let idx = 0; idx < entries.length; idx++) {
    const entry = entries[idx];
    const positionOnPage = idx + 1;
    const globalPosition = entry.rank_normalized !== null ? entry.rank_normalized : (nextPage - 1) * 30 + positionOnPage;
    const row = {
      source: 'qs_rankings', page_number: nextPage, position_on_page: positionOnPage,
      global_position: globalPosition, sort_position: nextSortPosition,
      rank_raw: entry.rank_raw, rank_normalized: entry.rank_normalized,
      rank_source: entry.rank_normalized !== null ? 'extracted' : 'fallback_position',
      qs_slug: entry.qs_slug, display_name: entry.display_name,
      source_profile_url: entry.source_profile_url, entity_type: 'university',
      crawl_status: 'profile_pending', results_per_page_observed: entries.length,
      discovery_method: 'page_scrape', acquisition_run_id: runId, trace_id: traceId,
    };
    const { error } = await srv.from('qs_page_entries').insert(row);
    if (error) { if (error.code === '23505') duplicateCount++; } else { insertedCount++; nextSortPosition++; }
  }

  // Save proof
  await srv.from('qs_page_proofs').insert({
    page_number: nextPage, page_url: pageUrl, snapshot_id: snapshot?.id,
    entry_count: entries.length, first_slug: entries[0]?.qs_slug, last_slug: entries[entries.length-1]?.qs_slug,
    first_rank_raw: entries[0]?.rank_raw, last_rank_raw: entries[entries.length-1]?.rank_raw,
    first_rank_normalized: entries[0]?.rank_normalized, last_rank_normalized: entries[entries.length-1]?.rank_normalized,
    results_per_page_observed: entries.length, valid_rank_count: guardrail.valid_rank_count,
    markdown_length: markdown.length, has_next_page: guardrail.has_next_page,
    is_valid: true, shell_reason: null, parse_warnings: guardrail.parse_warnings || [],
    acquisition_run_id: runId, trace_id: traceId, fetch_duration_ms: scrapeDuration,
  });

  const { count: totalEntries } = await srv.from('qs_page_entries').select('id', { head: true, count: 'exact' });
  await srv.from('qs_acquisition_cursor').update({
    current_page: nextPage, total_entries: totalEntries || 0, consecutive_errors: 0,
    last_tick_at: new Date().toISOString(),
    log: [...(cursor.log || []).slice(-20), `page_${nextPage}: ${entries.length} entries, ${insertedCount} new`],
  }).eq('id', 'qs_acq');

  if (!guardrail.has_next_page) {
    await transitionPhase(srv, cursor, 'profile_crawl');
    return json({ ok: true, message: 'acquisition_complete', page: nextPage, total_entries: totalEntries });
  }

  return json({ ok: true, page: nextPage, inserted: insertedCount, duplicates: duplicateCount, total_entries: totalEntries });
}

// ── Phase B: Profile Crawl ───────────────────────────
async function tickProfileCrawl(srv: any, cursor: any, runId: string, traceId: string, startTime: number) {
  const FIRECRAWL_KEY = Deno.env.get('FIRECRAWL_API_KEY');
  if (!FIRECRAWL_KEY) return json({ ok: false, error: 'FIRECRAWL_API_KEY not configured' }, 500);

  const { data: entries } = await srv.from('qs_page_entries')
    .select('id, qs_slug, source_profile_url, sort_position, profile_attempts')
    .eq('crawl_status', 'profile_pending').order('sort_position', { ascending: true }).limit(PROFILE_BATCH_SIZE);

  if (!entries || entries.length === 0) {
    // Check if any still fetching
    const { count: fetchingCount } = await srv.from('qs_page_entries').select('id', { head: true, count: 'exact' }).eq('crawl_status', 'profile_fetching');
    if ((fetchingCount || 0) > 0) return json({ ok: true, message: 'waiting_for_in_progress', fetching: fetchingCount });

    // All profiles done → transition to extraction
    await transitionPhase(srv, cursor, 'extraction');
    return json({ ok: true, message: 'profile_crawl_complete_starting_extraction' });
  }

  const results: any[] = [];
  for (const entry of entries) {
    if (Date.now() - startTime > TIME_BUDGET_MS) break;

    await srv.from('qs_page_entries').update({ crawl_status: 'profile_fetching', profile_run_id: runId }).eq('id', entry.id);

    try {
      const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${FIRECRAWL_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: entry.source_profile_url, formats: ['markdown', 'html'], waitFor: 5000 }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const attempts = (entry.profile_attempts || 0) + 1;
        await srv.from('qs_page_entries').update({ crawl_status: attempts >= 3 ? 'profile_failed' : 'profile_pending', profile_error: data.error || `HTTP ${res.status}`, profile_attempts: attempts }).eq('id', entry.id);
        results.push({ qs_slug: entry.qs_slug, status: 'failed' });
        continue;
      }

      const md = data.data?.markdown || data.markdown || '';
      const html = data.data?.html || data.html || '';
      const isShell = md.length < 300 || /University Directory Search|Search Results/i.test(md);

      // Save snapshot with both markdown AND html for JSON-LD extraction
      const { data: snap } = await srv.from('crawl_raw_snapshots').insert({
        source: 'qs_profile', source_url: entry.source_profile_url,
        raw_markdown: md, raw_html: html, fetch_method: 'firecrawl',
        fetched_at: new Date().toISOString(),
        metadata: { trace_id: traceId, markdown_length: md.length, html_length: html.length, qs_slug: entry.qs_slug },
      }).select('id').single();

      await srv.from('qs_page_entries').update({
        crawl_status: isShell ? 'profile_failed' : 'profile_done',
        profile_snapshot_id: snap?.id || null, profile_fetched_at: new Date().toISOString(),
        profile_attempts: (entry.profile_attempts || 0) + 1,
        profile_error: isShell ? 'shell_profile_detected' : null, profile_run_id: runId,
      }).eq('id', entry.id);

      results.push({ qs_slug: entry.qs_slug, status: isShell ? 'shell' : 'done', md_len: md.length });
    } catch (err) {
      const attempts = (entry.profile_attempts || 0) + 1;
      await srv.from('qs_page_entries').update({ crawl_status: attempts >= 3 ? 'profile_failed' : 'profile_pending', profile_error: String(err), profile_attempts: attempts }).eq('id', entry.id);
      results.push({ qs_slug: entry.qs_slug, status: 'error' });
    }
  }

  await srv.from('qs_acquisition_cursor').update({ last_tick_at: new Date().toISOString() }).eq('id', 'qs_acq');

  // INLINE EXTRACTION: For each profile_done entry that just completed, run extraction immediately
  const doneSlugs = results.filter(r => r.status === 'done').map(r => r.qs_slug);
  let extractedInline = 0;
  if (doneSlugs.length > 0) {
    for (const slug of doneSlugs) {
      if (Date.now() - startTime > TIME_BUDGET_MS - 5000) break;
      try {
        await extractSingleEntry(srv, slug, traceId);
        extractedInline++;
      } catch (e) {
        console.error(`[qs-orchestrator] Inline extraction failed for ${slug}:`, e);
      }
    }
  }

  return json({ ok: true, profiles_processed: results.length, extracted_inline: extractedInline, results });
}

// ── Phase C: Extraction (backfill for profile_done without extraction) ──
async function tickExtraction(srv: any, cursor: any, runId: string, traceId: string, startTime: number) {
  // Find profile_done entries that don't have qs_entity_profiles yet
  const { data: entries } = await srv
    .from('qs_page_entries')
    .select('id, qs_slug, display_name, source_profile_url, profile_snapshot_id, matched_university_id')
    .eq('crawl_status', 'profile_done')
    .not('profile_snapshot_id', 'is', null)
    .order('sort_position', { ascending: true })
    .limit(EXTRACT_BATCH_SIZE);

  if (!entries || entries.length === 0) {
    // Check if there are entries still pending profile crawl (late arrivals)
    const { count: pendingProfiles } = await srv.from('qs_page_entries').select('id', { head: true, count: 'exact' }).eq('crawl_status', 'profile_pending');
    if ((pendingProfiles || 0) > 0) {
      // Go back to profile_crawl phase
      await transitionPhase(srv, cursor, 'profile_crawl');
      return json({ ok: true, message: 'back_to_profile_crawl', pending: pendingProfiles });
    }

    // All done, transition to programme discovery
    await transitionPhase(srv, cursor, 'programme_discovery');
    return json({ ok: true, message: 'extraction_complete_starting_programme_discovery' });
  }

  let extracted = 0;
  for (const entry of entries) {
    if (Date.now() - startTime > TIME_BUDGET_MS) break;
    try {
      await extractSingleEntry(srv, entry.qs_slug, traceId);
      // Mark as extracted
      await srv.from('qs_page_entries').update({ crawl_status: 'extracted' }).eq('id', entry.id);
      extracted++;
    } catch (e) {
      console.error(`[qs-orchestrator] Extraction error for ${entry.qs_slug}:`, e);
      await srv.from('qs_page_entries').update({ crawl_status: 'extraction_failed', profile_error: String(e).slice(0, 500) }).eq('id', entry.id);
    }
  }

  await srv.from('qs_acquisition_cursor').update({ last_tick_at: new Date().toISOString() }).eq('id', 'qs_acq');
  return json({ ok: true, message: 'extraction_tick', extracted, batch: entries.length });
}

// ── Phase D: Programme Discovery ─────────────────────
async function tickProgrammeDiscovery(srv: any, cursor: any, runId: string, traceId: string, startTime: number) {
  // Find extracted entries that haven't had programme discovery
  const { data: entries } = await srv
    .from('qs_page_entries')
    .select('id, qs_slug, profile_snapshot_id')
    .eq('crawl_status', 'extracted')
    .not('profile_snapshot_id', 'is', null)
    .order('sort_position', { ascending: true })
    .limit(20);

  if (!entries || entries.length === 0) {
    // All discovered, transition to programme crawl
    const { count: progPending } = await srv.from('qs_programme_entries').select('id', { head: true, count: 'exact' }).eq('crawl_status', 'discovered');
    if ((progPending || 0) > 0) {
      await transitionPhase(srv, cursor, 'programme_crawl');
      return json({ ok: true, message: 'programme_discovery_complete', programmes_pending: progPending });
    }
    // No programmes found at all — go to completed
    await transitionPhase(srv, cursor, 'completed');
    await srv.from('qs_acquisition_cursor').update({ status: 'completed' }).eq('id', 'qs_acq');
    return json({ ok: true, message: 'no_programmes_found_completed' });
  }

  let totalDiscovered = 0;
  for (const entry of entries) {
    if (Date.now() - startTime > TIME_BUDGET_MS) break;

    try {
      const { data: snapshot } = await srv.from('crawl_raw_snapshots')
        .select('raw_markdown').eq('id', entry.profile_snapshot_id).single();
      if (!snapshot?.raw_markdown) continue;

      // Get entity_profile_id
      const { data: profile } = await srv.from('qs_entity_profiles')
        .select('id').eq('qs_slug', entry.qs_slug).maybeSingle();

      const programmes = discoverProgrammeLinks(snapshot.raw_markdown, entry.qs_slug);

      for (const prog of programmes) {
        const { error } = await srv.from('qs_programme_entries').insert({
          entity_profile_id: profile?.id || null,
          qs_slug: entry.qs_slug,
          programme_url: prog.url,
          title: prog.title,
          degree: prog.degree,
          level: prog.level,
          crawl_status: 'discovered',
          discovery_run_id: runId,
        });
        if (!error) totalDiscovered++;
        // Duplicate = skip silently
      }

      // Mark entry as programme_discovered
      await srv.from('qs_page_entries').update({ crawl_status: 'programme_discovered' }).eq('id', entry.id);
    } catch (e) {
      console.error(`[qs-orchestrator] Programme discovery error for ${entry.qs_slug}:`, e);
    }
  }

  await srv.from('qs_acquisition_cursor').update({ last_tick_at: new Date().toISOString() }).eq('id', 'qs_acq');
  return json({ ok: true, message: 'programme_discovery_tick', universities_processed: entries.length, programmes_discovered: totalDiscovered });
}

// ── Phase E: Programme Crawl ─────────────────────────
async function tickProgrammeCrawl(srv: any, cursor: any, runId: string, traceId: string, startTime: number) {
  const FIRECRAWL_KEY = Deno.env.get('FIRECRAWL_API_KEY');
  if (!FIRECRAWL_KEY) return json({ ok: false, error: 'FIRECRAWL_API_KEY not configured' }, 500);

  const { data: progs } = await srv.from('qs_programme_entries')
    .select('id, programme_url, qs_slug, title, entity_profile_id, fetch_attempts')
    .eq('crawl_status', 'discovered').order('created_at', { ascending: true }).limit(PROGRAMME_CRAWL_BATCH);

  if (!progs || progs.length === 0) {
    // All programmes crawled, transition to extraction
    const { count: pendingExtraction } = await srv.from('qs_programme_entries')
      .select('id', { head: true, count: 'exact' }).eq('crawl_status', 'profile_done');
    if ((pendingExtraction || 0) > 0) {
      await transitionPhase(srv, cursor, 'programme_extraction');
      return json({ ok: true, message: 'programme_crawl_complete_starting_extraction' });
    }
    await transitionPhase(srv, cursor, 'completed');
    await srv.from('qs_acquisition_cursor').update({ status: 'completed' }).eq('id', 'qs_acq');
    return json({ ok: true, message: 'all_phases_completed' });
  }

  const results: any[] = [];
  for (const prog of progs) {
    if (Date.now() - startTime > TIME_BUDGET_MS) break;

    await srv.from('qs_programme_entries').update({ crawl_status: 'fetching' }).eq('id', prog.id);

    try {
      const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${FIRECRAWL_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: prog.programme_url, formats: ['markdown', 'html'], waitFor: 5000 }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const attempts = (prog.fetch_attempts || 0) + 1;
        await srv.from('qs_programme_entries').update({
          crawl_status: attempts >= 3 ? 'failed' : 'discovered',
          error: data.error || `HTTP ${res.status}`, fetch_attempts: attempts,
        }).eq('id', prog.id);
        results.push({ url: prog.programme_url, status: 'failed' });
        continue;
      }

      const md = data.data?.markdown || data.markdown || '';
      const html = data.data?.html || data.html || '';
      const isShell = md.length < 200 || !prog.title;

      const { data: snap } = await srv.from('crawl_raw_snapshots').insert({
        source: 'qs_programme', source_url: prog.programme_url,
        raw_markdown: md, raw_html: html, fetch_method: 'firecrawl',
        fetched_at: new Date().toISOString(),
        metadata: { trace_id: traceId, qs_slug: prog.qs_slug, programme_title: prog.title },
      }).select('id').single();

      await srv.from('qs_programme_entries').update({
        crawl_status: isShell ? 'failed' : 'profile_done',
        snapshot_id: snap?.id, fetched_at: new Date().toISOString(),
        fetch_attempts: (prog.fetch_attempts || 0) + 1,
        error: isShell ? 'shell_page' : null, crawl_run_id: runId,
      }).eq('id', prog.id);

      // Inline extraction for programme
      if (!isShell && snap?.id) {
        try {
          await extractProgramme(srv, prog, snap.id, md, html, traceId);
          await srv.from('qs_programme_entries').update({ crawl_status: 'extracted' }).eq('id', prog.id);
        } catch (e) {
          console.error(`[qs-orchestrator] Programme extraction failed:`, e);
        }
      }

      results.push({ url: prog.programme_url, status: isShell ? 'shell' : 'done', md_len: md.length });
    } catch (err) {
      const attempts = (prog.fetch_attempts || 0) + 1;
      await srv.from('qs_programme_entries').update({ crawl_status: attempts >= 3 ? 'failed' : 'discovered', error: String(err), fetch_attempts: attempts }).eq('id', prog.id);
      results.push({ url: prog.programme_url, status: 'error' });
    }
  }

  await srv.from('qs_acquisition_cursor').update({ last_tick_at: new Date().toISOString() }).eq('id', 'qs_acq');
  return json({ ok: true, message: 'programme_crawl_tick', processed: results.length, results });
}

// ── Phase F: Programme Extraction (backfill) ─────────
async function tickProgrammeExtraction(srv: any, cursor: any, runId: string, traceId: string, startTime: number) {
  const { data: progs } = await srv.from('qs_programme_entries')
    .select('id, programme_url, qs_slug, title, entity_profile_id, snapshot_id')
    .eq('crawl_status', 'profile_done').not('snapshot_id', 'is', null)
    .order('created_at', { ascending: true }).limit(10);

  if (!progs || progs.length === 0) {
    await transitionPhase(srv, cursor, 'completed');
    await srv.from('qs_acquisition_cursor').update({ status: 'completed' }).eq('id', 'qs_acq');
    return json({ ok: true, message: 'all_phases_completed' });
  }

  let extracted = 0;
  for (const prog of progs) {
    if (Date.now() - startTime > TIME_BUDGET_MS) break;
    try {
      const { data: snap } = await srv.from('crawl_raw_snapshots').select('raw_markdown, raw_html').eq('id', prog.snapshot_id).single();
      if (!snap?.raw_markdown) continue;
      await extractProgramme(srv, prog, prog.snapshot_id, snap.raw_markdown, snap.raw_html || '', traceId);
      await srv.from('qs_programme_entries').update({ crawl_status: 'extracted' }).eq('id', prog.id);
      extracted++;
    } catch (e) {
      await srv.from('qs_programme_entries').update({ crawl_status: 'extraction_failed', error: String(e).slice(0, 500) }).eq('id', prog.id);
    }
  }

  await srv.from('qs_acquisition_cursor').update({ last_tick_at: new Date().toISOString() }).eq('id', 'qs_acq');
  return json({ ok: true, message: 'programme_extraction_tick', extracted });
}

// ══════════════════════════════════════════════════════
// EXTRACTION ENGINE (inline, no external function call)
// ══════════════════════════════════════════════════════

const ALL_SECTIONS = [
  "about", "university_info", "rankings", "cost_of_living",
  "student_life", "similar_universities", "social_links",
  "admissions", "students_staff", "official_website",
  "campus_locations", "media", "faqs", "facilities",
  "employability", "tuition_summary",
] as const;

const QS_BASE = "https://www.topuniversities.com";

async function extractSingleEntry(srv: any, qsSlug: string, traceId: string) {
  const { data: entry } = await srv.from('qs_page_entries')
    .select('id, qs_slug, display_name, source_profile_url, profile_snapshot_id, matched_university_id')
    .eq('qs_slug', qsSlug).eq('crawl_status', 'profile_done').not('profile_snapshot_id', 'is', null)
    .maybeSingle();
  if (!entry) return;

  const { data: snapshot } = await srv.from('crawl_raw_snapshots')
    .select('id, raw_markdown, raw_html').eq('id', entry.profile_snapshot_id).single();
  if (!snapshot?.raw_markdown || snapshot.raw_markdown.length < 300) return;

  const markdown = snapshot.raw_markdown;
  const html = snapshot.raw_html || '';
  const now = new Date().toISOString();

  // Lazy create entity profile
  let { data: existingProfile } = await srv.from('qs_entity_profiles').select('id').eq('qs_slug', qsSlug).maybeSingle();
  let entityProfileId: string;

  if (existingProfile) {
    entityProfileId = existingProfile.id;
  } else {
    const profileUrl = entry.source_profile_url || `${QS_BASE}/universities/${qsSlug}`;
    const { data: newProfile, error: insertErr } = await srv.from('qs_entity_profiles').insert({
      qs_slug: qsSlug, name: entry.display_name, qs_url: profileUrl,
      entity_type: 'university', university_id: entry.matched_university_id || null,
      raw_snapshot_id: snapshot.id, fetched_at: now, slug_source: 'qs_full_crawl',
    }).select('id').single();
    if (insertErr) {
      const { data: retry } = await srv.from('qs_entity_profiles').select('id').eq('qs_slug', qsSlug).single();
      if (!retry) throw new Error(`Cannot create entity profile for ${qsSlug}: ${insertErr.message}`);
      entityProfileId = retry.id;
    } else {
      entityProfileId = newProfile!.id;
    }
  }

  // Extract all sections
  const jsonLd = extractJsonLd(html);
  const sections = extractAllSections(markdown, jsonLd);
  const sectionResults: Record<string, string> = {};
  for (const s of ALL_SECTIONS) sectionResults[s] = "not_provided_in_qs_source";

  // About + University Info
  const updates: any = { raw_snapshot_id: snapshot.id, fetched_at: now };
  if (sections.about?.text) { updates.about_text = sections.about.text.slice(0, 5000); sectionResults.about = "extracted_from_qs_markdown"; }
  if (sections.university_info?.type) { updates.institution_type = sections.university_info.type; sectionResults.university_info = "extracted_from_qs_markdown"; }
  if (sections.official_website) { updates.official_website = sections.official_website; sectionResults.official_website = "extracted_from_qs_markdown"; }
  if (sections.programme_count) updates.programme_count_qs = sections.programme_count;
  if (sections.university_info?.city) updates.city = sections.university_info.city;
  if (sections.university_info?.country) updates.country = sections.university_info.country;
  await srv.from("qs_entity_profiles").update(updates).eq("id", entityProfileId);

  // Rankings
  if (sections.rankings) {
    const parsedRank = sections.rankings.world_rank ? parseInt(sections.rankings.world_rank) : null;
    if (parsedRank && parsedRank >= 2020 && parsedRank <= 2035) {
      sectionResults.rankings = "extraction_failed";
    } else {
      try {
        await srv.from("qs_ranking_snapshots").upsert({
          entity_profile_id: entityProfileId, ranking_year: new Date().getFullYear(),
          world_rank: parsedRank,
          overall_score: sections.rankings.overall_score ? parseFloat(sections.rankings.overall_score) : null,
          indicators: sections.rankings.indicators || null,
          subject_rankings: sections.rankings.subject_rankings || null, fetched_at: now,
        }, { onConflict: "entity_profile_id,ranking_year" });
        sectionResults.rankings = "extracted_from_qs_markdown";
      } catch (e) { sectionResults.rankings = "extraction_failed"; }
    }
  }

  // Students & Staff
  if (sections.students_staff) {
    try {
      await srv.from("qs_students_staff").upsert({
        entity_profile_id: entityProfileId,
        total_students: sections.students_staff.total_students || null,
        intl_students: sections.students_staff.intl_students || null,
        total_faculty: sections.students_staff.total_faculty || null,
        ug_pct: sections.students_staff.ug_pct || null,
        pg_pct: sections.students_staff.pg_pct || null, fetched_at: now,
      }, { onConflict: "entity_profile_id" });
      sectionResults.students_staff = "extracted_from_qs_markdown";
    } catch { sectionResults.students_staff = "extraction_failed"; }
  }

  // Cost of Living
  if (sections.cost_of_living) {
    try {
      const col = sections.cost_of_living;
      await srv.from("qs_cost_of_living").upsert({
        entity_profile_id: entityProfileId,
        accommodation_amount: parseAmount(col.accommodation_amount),
        food_amount: parseAmount(col.food_amount),
        transport_amount: parseAmount(col.transport_amount),
        utilities_amount: parseAmount(col.utilities_amount),
        currency: col.currency || null, raw_text: col.raw_text?.slice(0, 1000) || null,
        cost_of_living_text: col.raw_text?.slice(0, 2000) || null, fetched_at: now,
      }, { onConflict: "entity_profile_id" });
      sectionResults.cost_of_living = "extracted_from_qs_markdown";
    } catch { sectionResults.cost_of_living = "extraction_failed"; }
  }

  // Student Life
  if (sections.student_life) {
    try {
      await srv.from("qs_student_life").upsert({
        entity_profile_id: entityProfileId, dorms_available: sections.student_life.dorms_available || false,
        counselling_available: sections.student_life.counselling_available || false,
        clubs_count: sections.student_life.clubs_hint || null, fetched_at: now,
      }, { onConflict: "entity_profile_id" });
      sectionResults.student_life = "extracted_from_qs_markdown";
    } catch { sectionResults.student_life = "extraction_failed"; }
  }

  // Similar Universities
  if (sections.similar_entities?.length > 0) {
    try {
      const rows = sections.similar_entities.map((slug: string) => ({ entity_profile_id: entityProfileId, similar_qs_slug: slug }));
      await srv.from("qs_similar_entities").upsert(rows, { onConflict: "entity_profile_id,similar_qs_slug" });
      sectionResults.similar_universities = "extracted_from_qs_markdown";
    } catch { sectionResults.similar_universities = "extraction_failed"; }
  }

  // Social Links
  if (sections.social_links?.length > 0) {
    await srv.from("qs_entity_profiles").update({ social_links: sections.social_links }).eq("id", entityProfileId);
    sectionResults.social_links = "extracted_from_qs_markdown";
  }

  // Admissions
  if (sections.admissions) {
    try {
      await srv.from("qs_admission_summaries").upsert({
        entity_profile_id: entityProfileId, level: sections.admissions.level || "general",
        test_scores: sections.admissions.test_scores || null,
        admission_text: sections.admissions.text?.slice(0, 3000) || null, fetched_at: now,
      }, { onConflict: "entity_profile_id,level" });
      sectionResults.admissions = "extracted_from_qs_markdown";
    } catch { sectionResults.admissions = "extraction_failed"; }
  }

  // Campus Locations
  if (sections.campus_locations?.length > 0) {
    try {
      await srv.from("qs_campus_locations").delete().eq("entity_profile_id", entityProfileId);
      const rows = sections.campus_locations.map((c: any, i: number) => ({
        entity_profile_id: entityProfileId, campus_name: c.name || `Campus ${i+1}`,
        is_main: i === 0, address: c.address || null, city: c.city || null,
        country_code: c.country_code || null, fetched_at: now,
      }));
      await srv.from("qs_campus_locations").insert(rows);
      sectionResults.campus_locations = "extracted_from_qs_markdown";
    } catch { sectionResults.campus_locations = "extraction_failed"; }
  }

  // Media
  if (sections.media) {
    try {
      await srv.from("qs_media_assets").upsert({
        entity_profile_id: entityProfileId, logo_url: sections.media.logo_url || null,
        cover_image_url: sections.media.cover_image_url || null,
        photo_assets: sections.media.photos || null, video_assets: sections.media.videos || null,
        gallery_present: sections.media.gallery_present || false,
        map_present: sections.media.map_present || false, fetched_at: now,
      }, { onConflict: "entity_profile_id" });
      sectionResults.media = "extracted_from_qs_markdown";
    } catch { sectionResults.media = "extraction_failed"; }
  }

  // FAQs
  if (sections.faqs?.length > 0) {
    try {
      await srv.from("qs_faqs").delete().eq("entity_profile_id", entityProfileId);
      const rows = sections.faqs.map((f: any) => ({ entity_profile_id: entityProfileId, question: f.question, answer: f.answer, fetched_at: now }));
      await srv.from("qs_faqs").insert(rows);
      sectionResults.faqs = "extracted_from_qs_markdown";
    } catch { sectionResults.faqs = "extraction_failed"; }
  }

  // Facilities
  if (sections.facilities) {
    try {
      await srv.from("qs_facilities").upsert({ entity_profile_id: entityProfileId, facilities_text: sections.facilities.text?.slice(0, 3000) || null, fetched_at: now }, { onConflict: "entity_profile_id" });
      sectionResults.facilities = "extracted_from_qs_markdown";
    } catch { sectionResults.facilities = "extraction_failed"; }
  }

  // Employability
  if (sections.employability) {
    try {
      await srv.from("qs_employability").upsert({ entity_profile_id: entityProfileId, career_services_text: sections.employability.text?.slice(0, 3000) || null, service_list: sections.employability.services || null, fetched_at: now }, { onConflict: "entity_profile_id" });
      sectionResults.employability = "extracted_from_qs_markdown";
    } catch { sectionResults.employability = "extraction_failed"; }
  }

  // Tuition summary
  if (sections.tuition_summary) sectionResults.tuition_summary = "extracted_from_qs_markdown";

  // Section observations
  const crawlRunId = `extract-${qsSlug}-${Date.now()}`;
  const obsRows = ALL_SECTIONS.map((s) => ({
    entity_profile_id: entityProfileId, crawl_run_id: crawlRunId, section_name: s,
    status: sectionResults[s] === "extracted_from_qs_markdown" ? "extracted" :
            sectionResults[s] === "extraction_failed" ? "error" : "not_present",
    ignore_reason: sectionResults[s] === "not_provided_in_qs_source" ? "not_provided_in_qs_source" : null,
    quarantine_reason: sectionResults[s] === "extraction_failed" ? "extraction_error" : null,
    observed_at: now,
  }));
  await srv.from("qs_section_observations").insert(obsRows);
}

// ══════════════════════════════════════════════════════
// PROGRAMME EXTRACTION
// ══════════════════════════════════════════════════════

async function extractProgramme(srv: any, prog: any, snapshotId: string, markdown: string, html: string, traceId: string) {
  const fields = extractProgrammeFields(markdown, html);
  if (!fields.title && prog.title) fields.title = prog.title;
  if (!fields.title) throw new Error('no_title_extracted');

  await srv.from('qs_programme_details').upsert({
    programme_entry_id: prog.id,
    entity_profile_id: prog.entity_profile_id || null,
    title: fields.title, degree: fields.degree, level: fields.level,
    duration_text: fields.duration_text, duration_months: fields.duration_months,
    study_mode: fields.study_mode,
    tuition_domestic: fields.tuition_domestic, tuition_international: fields.tuition_international,
    tuition_currency: fields.tuition_currency,
    start_months: fields.start_months, deadline_raw: fields.deadline_raw,
    admission_requirements: fields.admission_requirements,
    subject_area: fields.subject_area, school_name: fields.school_name,
    language: fields.language, intake_info: fields.intake_info,
    raw_fields: fields.raw_fields, field_evidence_map: fields.evidence,
    snapshot_id: snapshotId, extracted_at: new Date().toISOString(),
  }, { onConflict: 'programme_entry_id' });
}

function extractProgrammeFields(markdown: string, html: string) {
  const fields: any = { evidence: {} };

  // Title
  const titleMatch = markdown.match(/^#\s+(.+)/m);
  if (titleMatch) { fields.title = titleMatch[1].replace(/\[.*?\]\(.*?\)/g, '').trim(); fields.evidence.title = titleMatch[0].slice(0, 200); }

  // Degree & Level
  const degreeMatch = markdown.match(/(?:Degree|Qualification|Award)[:\s]*([^\n]+)/i);
  if (degreeMatch) { fields.degree = degreeMatch[1].trim(); fields.evidence.degree = degreeMatch[0]; }
  if (/\b(?:PhD|Doctorate|DPhil)\b/i.test(markdown)) fields.level = 'doctoral';
  else if (/\b(?:Master|MSc|MA|MBA|MPhil|MEng)\b/i.test(markdown)) fields.level = 'master';
  else if (/\b(?:Bachelor|BSc|BA|BEng|Undergraduate)\b/i.test(markdown)) fields.level = 'bachelor';

  // Duration
  const durMatch = markdown.match(/(?:Duration|Length|Period)[:\s]*([^\n]+)/i);
  if (durMatch) {
    fields.duration_text = durMatch[1].trim();
    const yrs = durMatch[1].match(/(\d+)\s*year/i);
    const mos = durMatch[1].match(/(\d+)\s*month/i);
    fields.duration_months = yrs ? parseInt(yrs[1]) * 12 : mos ? parseInt(mos[1]) : null;
    fields.evidence.duration = durMatch[0];
  }

  // Study mode
  if (/\bfull[- ]?time\b/i.test(markdown)) fields.study_mode = 'full-time';
  else if (/\bpart[- ]?time\b/i.test(markdown)) fields.study_mode = 'part-time';
  else if (/\bonline\b/i.test(markdown)) fields.study_mode = 'online';

  // Tuition
  const tuitionBlock = markdown.match(/(?:Tuition|Fee|Cost)[\s\S]{0,500}/i);
  if (tuitionBlock) {
    const domMatch = tuitionBlock[0].match(/(?:domestic|local|home)[^$€£\d]*[\$€£]?\s*([\d,]+)/i);
    const intlMatch = tuitionBlock[0].match(/(?:international|overseas|foreign)[^$€£\d]*[\$€£]?\s*([\d,]+)/i);
    const anyAmount = tuitionBlock[0].match(/[\$€£]\s*([\d,]+)/);
    if (domMatch) fields.tuition_domestic = parseInt(domMatch[1].replace(/,/g, ''));
    if (intlMatch) fields.tuition_international = parseInt(intlMatch[1].replace(/,/g, ''));
    if (!domMatch && !intlMatch && anyAmount) fields.tuition_international = parseInt(anyAmount[1].replace(/,/g, ''));
    const curr = tuitionBlock[0].match(/([\$€£])/);
    fields.tuition_currency = curr?.[1] === '€' ? 'EUR' : curr?.[1] === '£' ? 'GBP' : 'USD';
    fields.evidence.tuition = tuitionBlock[0].slice(0, 300);
  }

  // Start months
  const startMatch = markdown.match(/(?:Start|Intake|Entry|Commence)[:\s]*([^\n]+)/i);
  if (startMatch) {
    const months: number[] = [];
    const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    for (let i = 0; i < monthNames.length; i++) {
      if (new RegExp(monthNames[i], 'i').test(startMatch[1])) months.push(i + 1);
    }
    if (months.length > 0) { fields.start_months = months; fields.evidence.start_months = startMatch[0]; }
    fields.intake_info = startMatch[1].trim();
  }

  // Deadline
  const deadlineMatch = markdown.match(/(?:Deadline|Application.*?date|Apply.*?by)[:\s]*([^\n]+)/i);
  if (deadlineMatch) { fields.deadline_raw = deadlineMatch[1].trim(); fields.evidence.deadline = deadlineMatch[0]; }

  // Admission requirements
  const admMatch = markdown.match(/(?:Admission|Entry|Eligibility|Requirements?)[:\s]*([\s\S]{10,500}?)(?=\n#{2,}|\n\n\n)/i);
  if (admMatch) { fields.admission_requirements = { text: admMatch[1].trim().slice(0, 1000) }; fields.evidence.admission = admMatch[0].slice(0, 300); }

  // Subject area
  const subMatch = markdown.match(/(?:Subject|Discipline|Field|Department)[:\s]*([^\n]+)/i);
  if (subMatch) { fields.subject_area = subMatch[1].trim(); }

  // School name
  const schoolMatch = markdown.match(/(?:School|Faculty|College|Department)[:\s]*([^\n]+)/i);
  if (schoolMatch) fields.school_name = schoolMatch[1].trim();

  // Language
  const langMatch = markdown.match(/(?:Language|Taught in)[:\s]*([^\n]+)/i);
  if (langMatch) { fields.language = langMatch[1].trim(); fields.evidence.language = langMatch[0]; }

  // Raw fields for audit
  fields.raw_fields = {
    markdown_length: markdown.length,
    has_html: html.length > 0,
  };

  return fields;
}

// ══════════════════════════════════════════════════════
// PROGRAMME DISCOVERY
// ══════════════════════════════════════════════════════

function discoverProgrammeLinks(markdown: string, universitySlug: string): { url: string; title: string; degree?: string; level?: string }[] {
  const programmes: { url: string; title: string; degree?: string; level?: string }[] = [];
  const seen = new Set<string>();

  // Pattern 1: Links to programme pages on QS
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/www\.topuniversities\.com\/universities\/[a-z0-9-]+\/[a-z0-9-]+)\)/gi;
  for (const m of markdown.matchAll(linkPattern)) {
    const title = m[1].replace(/!\[.*?\]\(.*?\)/g, '').trim();
    const url = m[2];
    // Skip non-programme links
    if (url.includes('/universities/' + universitySlug) && url !== `https://www.topuniversities.com/universities/${universitySlug}`) {
      if (!seen.has(url)) {
        seen.add(url);
        const level = /phd|doctor/i.test(title) ? 'doctoral' : /master|msc|mba/i.test(title) ? 'master' : /bachelor|bsc|ba\b/i.test(title) ? 'bachelor' : undefined;
        programmes.push({ url, title, level });
      }
    }
  }

  // Pattern 2: Programme listing sections
  const progSection = markdown.match(/(?:#{2,4}\s*(?:Programs?|Courses?|Degrees?)\s*[\s\S]*?)(?=#{2,4}\s*(?!Programs?|Courses?)[A-Z]|$)/i);
  if (progSection) {
    const links = [...progSection[0].matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi)];
    for (const l of links) {
      const url = l[2];
      if (!seen.has(url) && url.includes('topuniversities.com')) {
        seen.add(url);
        programmes.push({ url, title: l[1].trim() });
      }
    }
  }

  return programmes;
}

// ══════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════

async function transitionPhase(srv: any, cursor: any, newPhase: string) {
  await srv.from('qs_acquisition_cursor').update({
    phase: newPhase, last_tick_at: new Date().toISOString(),
    log: [...(cursor.log || []).slice(-20), `transition_to_${newPhase}`],
  }).eq('id', 'qs_acq');
}

function parseAmount(val: string | undefined): number | null {
  if (!val) return null;
  const num = parseInt(val.replace(/,/g, ""), 10);
  return isNaN(num) ? null : num;
}

// ══════════════════════════════════════════════════════
// INLINE PARSER (ranking pages)
// ══════════════════════════════════════════════════════

interface ParsedEntry {
  rank_raw: string; rank_normalized: number | null; display_name: string;
  source_profile_url: string; qs_slug: string; overall_score: string | null; location: string | null;
}

function normalizeRank(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/^=/, '').trim();
  const rangeMatch = cleaned.match(/^(\d+)/);
  if (!rangeMatch) return null;
  const num = parseInt(rangeMatch[1], 10);
  if (num >= 2020 && num <= 2035) return null;
  return isNaN(num) ? null : num;
}

function parseMarkdownEntries(markdown: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const lines = markdown.split('\n');

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== 'Rank') continue;
    let j = i + 1;
    while (j < lines.length && !lines[j].trim()) j++;
    if (j >= lines.length) continue;
    const rankLine = lines[j].trim();
    if (!/^\=?\d+[\-\+]?\d*$/.test(rankLine)) continue;

    let overallScore: string | null = null, profileUrl = '', displayName = '', location: string | null = null;
    for (let k = j + 1; k < Math.min(j + 30, lines.length); k++) {
      const line = lines[k];
      const scoreMatch = line.match(/Overall Score:([\d.]+)/);
      if (scoreMatch) overallScore = scoreMatch[1];
      const profileMatch = line.match(/\]\(https:\/\/www\.topuniversities\.com\/universities\/([a-z0-9\-]+)\)/i);
      if (profileMatch && !profileUrl) {
        const slug = profileMatch[1].toLowerCase();
        profileUrl = `https://www.topuniversities.com/universities/${slug}`;
        const nameMatch = line.match(/\[([^\]]+)\]\(https:\/\/www\.topuniversities\.com\/universities\//);
        if (nameMatch) displayName = nameMatch[1].replace(/!\[.*?\]\(.*?\)/g, '').trim();
      }
      const locMatch = line.match(/location\.svg\)\s*(.+)/);
      if (locMatch) location = locMatch[1].trim();
      if (k > j + 5 && lines[k].trim() === 'Rank') break;
      if (line.includes('In order to see the data')) break;
    }

    if (!profileUrl || !displayName || !rankLine) continue;
    const slugMatch = profileUrl.match(/\/universities\/([a-z0-9\-]+)/i);
    const slug = slugMatch ? slugMatch[1].toLowerCase() : null;
    if (!slug) continue;
    const rejected = ['search', 'ranking', 'compare', 'rankings', 'find'];
    if (rejected.some(r => slug === r || slug.startsWith(r + '-'))) continue;
    entries.push({ rank_raw: rankLine, rank_normalized: normalizeRank(rankLine), display_name: displayName, source_profile_url: profileUrl, qs_slug: slug, overall_score: overallScore, location });
  }
  return entries;
}

function applyGuardrail(markdown: string, entries: ParsedEntry[], pageNumber: number) {
  const markdownLength = markdown.length, entryCount = entries.length;
  const validRankCount = entries.filter(e => e.rank_normalized !== null).length;
  const nextPagePattern = new RegExp(`#page-${pageNumber + 1}|page=${pageNumber + 1}`, 'i');
  const hasNextPage = nextPagePattern.test(markdown);
  const hasRankingTitle = /Rankings?\s*2026|QS World University/i.test(markdown);

  if (markdownLength < 500) return { is_valid: false, shell_reason: 'markdown_too_short', has_next_page: hasNextPage, valid_rank_count: validRankCount, markdown_length: markdownLength, entry_count: entryCount, parse_warnings: [] };
  if (entryCount < 5 && entryCount > 0 && !hasNextPage && validRankCount >= 1) return { is_valid: true, shell_reason: null, has_next_page: false, valid_rank_count: validRankCount, markdown_length: markdownLength, entry_count: entryCount, parse_warnings: ['terminal_short_page_accepted'] };
  if (entryCount < 5) return { is_valid: false, shell_reason: `too_few_entries:${entryCount}`, has_next_page: hasNextPage, valid_rank_count: validRankCount, markdown_length: markdownLength, entry_count: entryCount, parse_warnings: [] };
  if (validRankCount < entryCount * 0.8) return { is_valid: false, shell_reason: `low_valid_rank_ratio:${validRankCount}/${entryCount}`, has_next_page: hasNextPage, valid_rank_count: validRankCount, markdown_length: markdownLength, entry_count: entryCount, parse_warnings: [] };
  if (!hasRankingTitle) return { is_valid: false, shell_reason: 'missing_ranking_title', has_next_page: hasNextPage, valid_rank_count: validRankCount, markdown_length: markdownLength, entry_count: entryCount, parse_warnings: [] };
  return { is_valid: true, shell_reason: null, has_next_page: hasNextPage, valid_rank_count: validRankCount, markdown_length: markdownLength, entry_count: entryCount, parse_warnings: [] };
}

// ══════════════════════════════════════════════════════
// JSON-LD + Section Extraction (from qs-extract-from-snapshot)
// ══════════════════════════════════════════════════════

interface JsonLdData {
  faqs: { question: string; answer: string }[];
  campuses: { name: string; address: string; city: string; postalCode: string; country: string; lat?: string; lng?: string }[];
  images: string[];
  logoUrl?: string;
  name?: string;
}

function extractJsonLd(html: string): JsonLdData {
  const result: JsonLdData = { faqs: [], campuses: [], images: [] };
  if (!html) return result;
  const jsonLdBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  for (const block of jsonLdBlocks) {
    try {
      const parsed = JSON.parse(block[1]);
      if (parsed["@type"] === "FAQPage" && Array.isArray(parsed.mainEntity)) {
        for (const q of parsed.mainEntity) {
          if (q["@type"] === "Question" && q.name && q.acceptedAnswer?.text) {
            result.faqs.push({ question: q.name.trim(), answer: q.acceptedAnswer.text.replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000) });
          }
        }
      }
      if (parsed["@type"] === "CollegeOrUniversity" && Array.isArray(parsed.department)) {
        for (const dept of parsed.department) {
          if (dept.address) {
            const addr = dept.address;
            const geo = dept.location?.geo;
            result.campuses.push({ name: dept.name || "Campus", address: addr.streetAddress || "", city: addr.addressLocality || "", postalCode: addr.postalCode || "", country: addr.addressCountry || "", lat: geo?.latitude, lng: geo?.longitude });
          }
        }
      }
      if (parsed["@type"] === "ProfilePage") {
        result.name = parsed.name;
        if (parsed.mainEntity) {
          if (parsed.mainEntity.logo) result.logoUrl = parsed.mainEntity.logo;
          if (Array.isArray(parsed.mainEntity.image)) result.images = parsed.mainEntity.image;
        }
      }
    } catch { }
  }
  return result;
}

function extractAllSections(content: string, jsonLd: JsonLdData) {
  const result: any = {};

  // About
  const aboutMatch = content.match(/## About .+?\n\n([\s\S]+?)(?=\n\[Read (?:more|less)\])/i);
  if (aboutMatch) {
    const fullAboutMatch = content.match(/## About .+?\n\n[\s\S]*?\[Read more\][^\n]*\n\n([\s\S]+?)(?=\n\[Read less\])/i);
    result.about = { text: (fullAboutMatch?.[1] || aboutMatch[1]).trim().slice(0, 5000) };
  }

  // University Info
  const typePrivate = /\bprivate\b/i.test(content.slice(0, 5000));
  const typePublic = /\bpublic\b/i.test(content.slice(0, 5000));
  const institutionType = typePrivate ? "Private" : typePublic ? "Public" : null;
  const foundedMatch = content.match(/(?:founded|established)\s*(?:in\s+)?(\d{4})/i);
  const cityMatch = content.match(/location\.svg\)\s*([^,\n]+),?\s*([^\n]*)/);
  if (institutionType || foundedMatch || cityMatch) {
    result.university_info = {
      type: institutionType, founded: foundedMatch ? parseInt(foundedMatch[1]) : null,
      city: cityMatch?.[1]?.trim() || null, country: cityMatch?.[2]?.trim() || null,
    };
  }

  // Official Website
  const officialMatch = content.match(/(?:Official Website|Visit (?:Institution )?Website|Visit Site)\]\((https?:\/\/(?!www\.topuniversities)[^\s)]+)\)/i);
  const websiteHeadingMatch = content.match(/###?\s*(?:Official )?Website\n\n(https?:\/\/(?!www\.topuniversities)[^\s]+)/i);
  const websiteLabelMatch = content.match(/\[(?:website|official site|university website)\]\((https?:\/\/(?!www\.topuniversities)[^\s)]+)\)/i);
  const titleLinkMatch = content.match(/^# \[.+?\]\((https?:\/\/(?!www\.topuniversities)[^\s)]+)\)/m);
  if (officialMatch) result.official_website = officialMatch[1];
  else if (websiteHeadingMatch) result.official_website = websiteHeadingMatch[1];
  else if (websiteLabelMatch) result.official_website = websiteLabelMatch[1];
  else if (titleLinkMatch) result.official_website = titleLinkMatch[1];

  // Rankings
  const rankMatch = content.match(/###\s*\\{0,2}#\s*=?(\d+)\s*QS World University Rankings/i);
  if (rankMatch) {
    result.rankings = { world_rank: rankMatch[1] };
    const overallMatch = content.match(/Overall\n\n([\d.]+)\n/);
    if (overallMatch) result.rankings.overall_score = overallMatch[1];
    const indicatorNames = ["Academic Reputation","Citations per Faculty","Employment Outcomes","Employer Reputation","Faculty Student Ratio","International Faculty Ratio","International Research Network","International Student Diversity","International Student Ratio","Sustainability"];
    const indicators: Record<string, number> = {};
    for (const name of indicatorNames) {
      const re = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "\\n\\n([\\d.]+)", "i");
      const m = content.match(re);
      if (m) indicators[name] = parseFloat(m[1]);
    }
    if (Object.keys(indicators).length > 0) result.rankings.indicators = indicators;
    const subjectMatches = [...content.matchAll(/\[#=?(\d+)\\?\n\*\*(.+?)\*\*\]/g)];
    if (subjectMatches.length > 0) {
      result.rankings.subject_rankings = subjectMatches.filter(m => !m[2].includes("QS World")).map(m => ({ subject: m[2].trim(), rank: parseInt(m[1]) }));
    }
  }

  // Programme count
  const progCountMatch = content.match(/###\s*(\d+)\s*Undergrad & Postgrad Programmes/i);
  if (progCountMatch) result.programme_count = parseInt(progCountMatch[1]);

  // Cost of Living
  const colSection = content.match(/(?:#{2,4}\s*Cost of Living[\s\S]*?)(?=#{2,4}\s*(?:Scholarships|Employability|Rankings|Videos|Campus Locations|FAQ|Facilities|Similar|Students & Staff)|$)/i);
  const colFallback = !colSection ? content.match(/(Accommodation[\s\S]{0,100}[\$€£][\d,]+[\s\S]{0,500}(?:Transport|Food|Utilities)[\s\S]{0,200}[\$€£]?[\d,]+)/i) : null;
  const colText = colSection?.[0] || colFallback?.[0] || "";
  if (colText.length > 20) {
    const col: any = {};
    const accMatch2 = colText.match(/Accommodation\n\n[\$€£]?([\d,]+)/);
    const foodMatch = colText.match(/Food\n\n[\$€£]?([\d,]+)/);
    const transportMatch = colText.match(/Transport\n\n[\$€£]?([\d,]+)/);
    const utilitiesMatch = colText.match(/Utilities\n\n[\$€£]?([\d,]+)/);
    const currencyMatch = colText.match(/([\$€£])\d/);
    if (accMatch2) col.accommodation_amount = accMatch2[1].replace(/,/g, "");
    if (foodMatch) col.food_amount = foodMatch[1].replace(/,/g, "");
    if (transportMatch) col.transport_amount = transportMatch[1].replace(/,/g, "");
    if (utilitiesMatch) col.utilities_amount = utilitiesMatch[1].replace(/,/g, "");
    col.currency = currencyMatch?.[1] === "€" ? "EUR" : currencyMatch?.[1] === "£" ? "GBP" : "USD";
    const colDescMatch = colText.match(/(?:##|####)\s*Cost of Living\n\n(.+?)(?:\n\n####|\n\n#####)/s);
    col.raw_text = colDescMatch ? colDescMatch[1].trim().slice(0, 2000) : colText.replace(/#{1,5}[^\n]*/g, "").trim().slice(0, 2000);
    if (col.accommodation_amount || col.food_amount || col.transport_amount || col.utilities_amount || col.raw_text) result.cost_of_living = col;
  }

  // Student Life
  const studentLifeMatch = content.match(/####?\s*Student life\n\n([\s\S]+?)(?=####?\s|## [A-Z])/i);
  if (studentLifeMatch) {
    const slText = studentLifeMatch[1];
    result.student_life = { dorms_available: /dorm|residence|housing|on.campus.(?:living|accommodation)/i.test(slText), counselling_available: /counsell|mental.health|support.services/i.test(slText), clubs_hint: (slText.match(/(?:clubs?|societ|organization)/gi) || []).length };
  }

  // Similar Universities
  const simMatch = content.match(/similar.universit[\s\S]{0,500}/i);
  if (simMatch) {
    const slugs = (simMatch[0].match(/\/universities\/([a-z0-9-]+)/g) || []).map((l: string) => l.replace("/universities/", ""));
    if (slugs.length > 0) result.similar_entities = [...new Set(slugs)];
  }

  // Social Links
  const socials: string[] = [];
  if (/facebook\.com/i.test(content)) socials.push("facebook");
  if (/(?:twitter|x)\.com/i.test(content)) socials.push("twitter");
  if (/linkedin\.com/i.test(content)) socials.push("linkedin");
  if (/instagram\.com/i.test(content)) socials.push("instagram");
  if (/youtube\.com/i.test(content)) socials.push("youtube");
  if (socials.length > 0) result.social_links = socials;

  // Admissions
  const admSection = content.match(/(?:## Admission|#### (?:Admission|Bachelor|Master))[\s\S]*?(?=## [A-Z]|#### (?:Employability|Cost|Student|Facilities|Ranking|Campus|FAQ|Scholarship))/i);
  if (admSection) {
    const admText = admSection[0];
    const admResult: any = { text: admText.replace(/#{1,5}[^\n]*/g, "").replace(/\[.*?\]/g, "").trim().slice(0, 3000) };
    const testScores: Record<string, string> = {};
    const ieltsMatch = admText.match(/IELTS\n\n([\d.]+)\+?/i);
    const toeflMatch = admText.match(/TOEFL\n\n(\d{2,3})\+?/i);
    const gpaMatch = admText.match(/(?:Bachelor )?GPA\n\n([\d.]+)\+?/i);
    const gmatMatch = admText.match(/GMAT\n\n(\d{3})\+?/i);
    const greMatch = admText.match(/GRE\n\n(\d{3})\+?/i);
    if (ieltsMatch) testScores.ielts = ieltsMatch[1];
    if (toeflMatch) testScores.toefl = toeflMatch[1];
    if (gpaMatch) testScores.gpa = gpaMatch[1];
    if (gmatMatch) testScores.gmat = gmatMatch[1];
    if (greMatch) testScores.gre = greMatch[1];
    admResult.test_scores = Object.keys(testScores).length > 0 ? testScores : null;
    admResult.level = /postgrad|master|mba|phd/i.test(admText) ? "postgraduate" : "general";
    result.admissions = admResult;
  }

  // Students & Staff
  const ssSection = content.match(/## Students & Staff[\s\S]*?(?=## [A-Z]|####)/i);
  if (ssSection) {
    const ss: any = {};
    const ssText = ssSection[0];
    const totalMatch = ssText.match(/Total students\n\n([\d,]+)/i);
    const intlMatch = ssText.match(/International students\n\n([\d,]+)/i);
    const facultyMatch = ssText.match(/Total faculty staff\n\n([\d,]+)/i);
    if (totalMatch) ss.total_students = parseInt(totalMatch[1].replace(/,/g, ""));
    if (intlMatch) ss.intl_students = parseInt(intlMatch[1].replace(/,/g, ""));
    if (facultyMatch) ss.total_faculty = parseInt(facultyMatch[1].replace(/,/g, ""));
    if (Object.keys(ss).length > 0) result.students_staff = ss;
  }

  // Campus Locations
  if (jsonLd.campuses.length > 0) {
    result.campus_locations = jsonLd.campuses.map((c, i) => ({ name: c.name, address: c.address, city: c.city, country_code: c.country, postal_code: c.postalCode, is_main: i === 0 }));
  } else {
    const campusSection = content.match(/## Campus locations[\s\S]*?(?=## [A-Z]|#### Frequently)/i);
    if (campusSection) {
      const addresses = [...campusSection[0].matchAll(/^([^\n]{5,80})\n\n([^\n]+),?\n\n([A-Z]{2})\n\n(\d+)?/gm)];
      if (addresses.length > 0) result.campus_locations = addresses.map((m, i) => ({ address: m[1].trim(), city: m[2].trim(), country_code: m[3], postal_code: m[4] || null, is_main: i === 0 }));
    }
  }

  // Media
  const mediaResult: any = { gallery_present: false, map_present: false };
  if (jsonLd.logoUrl) mediaResult.logo_url = jsonLd.logoUrl;
  else { const logoMatch = content.match(/!\[university logo\]\(([^\s)]+)\)/i); if (logoMatch) mediaResult.logo_url = logoMatch[1]; }
  if (jsonLd.images.length > 0) { mediaResult.photos = jsonLd.images.slice(0, 20); mediaResult.gallery_present = true; }
  else { const gm = [...content.matchAll(/profiles-slideshow\/\d+\/([^\s")]+)/g)]; if (gm.length > 0) { mediaResult.photos = gm.slice(0, 20).map(m => m[0]); mediaResult.gallery_present = true; } }
  const ytMatches = [...content.matchAll(/img\.youtube\.com\/vi\/([\w-]+)/g)];
  if (ytMatches.length > 0) mediaResult.videos = [...new Set(ytMatches.map(m => m[1]))].map(id => ({ platform: "youtube", id }));
  mediaResult.map_present = /Open in Maps/i.test(content);
  if (mediaResult.logo_url || mediaResult.videos?.length > 0 || mediaResult.gallery_present) result.media = mediaResult;

  // FAQs
  if (jsonLd.faqs.length > 0) result.faqs = jsonLd.faqs;
  else {
    const faqSection = content.match(/(?:####?\s*Frequently Asked Questions)([\s\S]*?)(?=## [A-Z]|####?\s*(?!Frequently))/i);
    if (faqSection) {
      const faqParts = faqSection[1].split(/\n{3,}/);
      const faqs: { question: string; answer: string }[] = [];
      for (let i = 0; i < faqParts.length - 1; i++) {
        const q = faqParts[i].trim(), a = faqParts[i + 1].trim();
        if (q && q.length > 10 && q.length < 500 && a && a.length > 15 && !q.startsWith("[") && !q.startsWith("!")) { faqs.push({ question: q, answer: a.slice(0, 1000) }); i++; }
      }
      if (faqs.length > 0) result.faqs = faqs;
    }
  }

  // Facilities
  const facSection = content.match(/## Facilities\n\n([\s\S]+?)(?=## [A-Z]|#### )/i);
  if (facSection) result.facilities = { text: facSection[1].replace(/\[.*?\]/g, "").trim().slice(0, 3000) };

  // Employability
  const empSection = content.match(/(?:#{2,4}\s*(?:Career Services?|Employability|Career services and employability))\n\n([\s\S]+?)(?=#{2,4}\s*(?!Career|Employability)[A-Z])/i);
  const empFallback = !empSection ? content.match(/(?:#{2,4}\s*(?:Career|Employment|Graduate Outcomes)[\s\S]*?)\n\n([\s\S]+?)(?=#{2,4}\s*[A-Z])/i) : null;
  const empRaw = empSection?.[1] || empFallback?.[1] || "";
  if (empRaw.length > 20) {
    const empText = empRaw.replace(/\[.*?\]\(.*?\)/g, "").trim();
    result.employability = { text: empText.slice(0, 3000), services: null };
    const serviceList = [...empText.matchAll(/^[-•*]\s*(.+)/gm)];
    if (serviceList.length > 0) result.employability.services = serviceList.map(m => m[1].trim());
  }

  // Tuition summary
  if (/tuition|fee|cost.of.study/i.test(content)) {
    const tuitionMatch = content.match(/tuition[\s\S]{0,200}/i);
    if (tuitionMatch) result.tuition_summary = { raw: tuitionMatch[0].slice(0, 300) };
  }

  return result;
}
