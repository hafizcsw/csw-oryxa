/**
 * Website Enrichment Orchestrator v3
 * 
 * Supports controlled batch limits via filter.max_rows.
 * Applies city + country_code from enrichment results.
 * Applies partial (city/country only) matches separately.
 */
import { getSupabaseAdmin } from '../_shared/supabase.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-client-trace-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function respond(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function canonicalizeHomepageUrl(rawUrl: string): { canonical: string; raw: string } {
  if (!rawUrl) return { canonical: '', raw: rawUrl };
  let url = rawUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) url = `https://${url}`;
  const raw = url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:') parsed.protocol = 'https:';
    const nonHomePaths = [
      '/home.aspx', '/home.html', '/home.htm', '/index.html', '/index.htm', '/index.aspx',
      '/index.php', '/default.aspx', '/default.html', '/main.html',
      '/alumni', '/alumni/', '/about', '/about/', '/about-us', '/about-us/',
      '/en', '/en/', '/ar', '/ar/', '/de', '/de/', '/fr', '/fr/',
      '/Pages/home.aspx', '/Pages/default.aspx',
    ];
    const lp = parsed.pathname.toLowerCase();
    for (const p of nonHomePaths) {
      if (lp === p.toLowerCase() || lp.startsWith(p.toLowerCase())) { parsed.pathname = '/'; break; }
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    parsed.search = ''; parsed.hash = '';
    return { canonical: parsed.toString().replace(/\/+$/, ''), raw };
  } catch { return { canonical: url.replace(/\/+$/, ''), raw }; }
}

function extractDomain(url: string): string | null {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = getSupabaseAdmin();

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // === PREFLIGHT ===
    if (action === 'preflight') {
      const filter = body.filter || {};
      const { data: activeJobs } = await supabase
        .from('website_enrichment_jobs')
        .select('id, status, filter_criteria, total_rows')
        .in('status', ['queued', 'running', 'paused']);

      const blockers: string[] = [];
      if (activeJobs && activeJobs.length > 0) blockers.push(`active_jobs_exist:${activeJobs.length}`);

      // Count total target
      let query = supabase.from('universities').select('id', { count: 'exact', head: true })
        .eq('is_active', true).or('website.is.null,website.eq.');
      if (filter.country_code) query = query.eq('country_code', filter.country_code);
      const { count: totalTarget } = await query;

      // Effective count based on max_rows
      const maxRows = filter.max_rows || null;
      const effectiveTarget = maxRows ? Math.min(maxRows, totalTarget || 0) : (totalTarget || 0);

      return respond({
        ok: true,
        can_start: blockers.length === 0,
        blockers,
        target_count: effectiveTarget,
        total_available: totalTarget || 0,
        max_rows: maxRows,
        providers_enabled: ['openalex', 'ror', 'wikidata'],
        providers_status: { openalex: true, ror: true, wikidata: true },
        active_jobs: activeJobs || [],
        batch_size: body.batch_size || 20,
      });
    }

    // === CREATE JOB ===
    if (action === 'create') {
      const filter = body.filter || {};
      const batchSize = body.batch_size || 20;

      if (!body.force) {
        const { data: activeJobs } = await supabase
          .from('website_enrichment_jobs').select('id')
          .in('status', ['queued', 'running', 'paused']).limit(1);
        if (activeJobs && activeJobs.length > 0) {
          return respond({ ok: false, error: 'active_job_exists', active_job_id: activeJobs[0].id }, 409);
        }
      }

      let query = supabase.from('universities').select('id', { count: 'exact', head: true })
        .eq('is_active', true).or('website.is.null,website.eq.');
      if (filter.country_code) query = query.eq('country_code', filter.country_code);
      const { count: totalTarget } = await query;

      const maxRows = filter.max_rows || null;
      const effectiveCount = maxRows ? Math.min(maxRows, totalTarget || 0) : (totalTarget || 0);

      const { data: job, error } = await supabase
        .from('website_enrichment_jobs')
        .insert({
          status: 'queued',
          filter_criteria: filter,
          total_rows: effectiveCount,
          batch_size: batchSize,
          provider_config: { providers: ['openalex', 'ror', 'wikidata'] },
        })
        .select().single();

      if (error) return respond({ ok: false, error: error.message }, 400);
      return respond({ ok: true, job });
    }

    // === START JOB ===
    if (action === 'start') {
      const jobId = body.job_id;
      if (!jobId) return respond({ ok: false, error: 'job_id required' }, 400);

      const { error } = await supabase.from('website_enrichment_jobs')
        .update({ status: 'running', started_at: new Date().toISOString(), last_activity_at: new Date().toISOString() })
        .eq('id', jobId).in('status', ['queued', 'paused']);
      if (error) return respond({ ok: false, error: error.message }, 400);

      // Pre-seed rows (RPC respects max_rows)
      let totalSeeded = 0, batchSeeded = 0;
      do {
        const { data } = await supabase.rpc('rpc_we_pick_batch', { p_job_id: jobId, p_batch_size: 5000 });
        batchSeeded = data || 0;
        totalSeeded += batchSeeded;
      } while (batchSeeded > 0);

      // v10: PREFLIGHT GUARD — verify no rows have missing identity fields
      const { count: nullNameCount } = await supabase
        .from('website_enrichment_rows')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', jobId)
        .or('university_name.is.null,university_name.eq.');
      
      if (nullNameCount && nullNameCount > 0) {
        // ABORT: batch has rows without university_name
        console.error(`[WE-orch] PREFLIGHT FAIL: ${nullNameCount} rows missing university_name. Aborting job ${jobId}.`);
        await supabase.from('website_enrichment_jobs')
          .update({ status: 'failed', completed_at: new Date().toISOString() })
          .eq('id', jobId);
        await supabase.from('website_enrichment_rows')
          .delete().eq('job_id', jobId);
        return respond({
          ok: false,
          error: `Preflight failed: ${nullNameCount}/${totalSeeded} rows missing university_name. Batch aborted.`,
          null_name_count: nullNameCount,
          total_seeded: totalSeeded,
        }, 400);
      }

      return respond({ ok: true, message: 'Job started', total_seeded: totalSeeded, preflight_passed: true });
    }

    // === PAUSE ===
    if (action === 'pause') {
      await supabase.from('website_enrichment_jobs')
        .update({ status: 'paused', paused_at: new Date().toISOString() })
        .eq('id', body.job_id).eq('status', 'running');
      return respond({ ok: true });
    }

    // === RESUME ===
    if (action === 'resume') {
      await supabase.from('website_enrichment_jobs')
        .update({ status: 'running', paused_at: null, last_activity_at: new Date().toISOString() })
        .eq('id', body.job_id).eq('status', 'paused');
      return respond({ ok: true });
    }

    // === CANCEL ===
    if (action === 'cancel') {
      await supabase.from('website_enrichment_jobs')
        .update({ status: 'cancelled', completed_at: new Date().toISOString(), tick_lease_owner: null, tick_lease_expires_at: null })
        .eq('id', body.job_id).in('status', ['queued', 'running', 'paused']);
      return respond({ ok: true });
    }

    // === STATUS ===
    if (action === 'status') {
      if (body.job_id) {
        const { data: job } = await supabase.from('website_enrichment_jobs').select('*').eq('id', body.job_id).single();
        return respond({ ok: true, job });
      }
      const { data: jobs } = await supabase.from('website_enrichment_jobs').select('*')
        .order('created_at', { ascending: false }).limit(20);
      return respond({ ok: true, jobs });
    }

    // === CLEANUP EXISTING (remove rows for universities that already have website) ===
    if (action === 'cleanup_existing') {
      const jobId = body.job_id as string | undefined;
      const nowIso = new Date().toISOString();
      const targetStatuses = ['matched', 'review', 'approved', 'partial'];
      const pageSize = 500;

      let cleaned = 0;
      let scanned = 0;
      let lastId: string | null = null;
      const affectedJobIds = new Set<string>();

      while (true) {
        let q = supabase
          .from('website_enrichment_rows')
          .select('id, university_id, job_id')
          .in('enrichment_status', targetStatuses)
          .order('id', { ascending: true })
          .limit(pageSize);

        if (jobId) q = q.eq('job_id', jobId);
        if (lastId) q = q.gt('id', lastId);

        const { data: rows, error: rowsErr } = await q;
        if (rowsErr) return respond({ ok: false, error: rowsErr.message }, 400);
        if (!rows || rows.length === 0) break;

        scanned += rows.length;
        lastId = rows[rows.length - 1].id;

        const uniIds = [...new Set(rows.map(r => r.university_id))];
        const { data: withWebsite, error: uniErr } = await supabase
          .from('universities')
          .select('id')
          .in('id', uniIds)
          .not('website', 'is', null)
          .neq('website', '');

        if (uniErr) return respond({ ok: false, error: uniErr.message }, 400);

        const withWebsiteSet = new Set((withWebsite || []).map(u => u.id));
        const rowsToUpdate = rows.filter(r => withWebsiteSet.has(r.university_id));
        const rowIds = rowsToUpdate.map(r => r.id);

        if (rowIds.length > 0) {
          rowsToUpdate.forEach(r => affectedJobIds.add(r.job_id));
          const { error: updErr } = await supabase
            .from('website_enrichment_rows')
            .update({
              enrichment_status: 'skipped_existing',
              needs_manual_review: false,
              reviewed_at: nowIso,
              review_note: 'auto_cleanup_has_website',
              updated_at: nowIso,
            })
            .in('id', rowIds);

          if (updErr) return respond({ ok: false, error: updErr.message }, 400);
          cleaned += rowIds.length;
        }

        if (rows.length < pageSize) break;
      }

      if (jobId) affectedJobIds.add(jobId);

      for (const affectedJobId of affectedJobIds) {
        const { data: statusRows, error: statusErr } = await supabase
          .from('website_enrichment_rows')
          .select('enrichment_status')
          .eq('job_id', affectedJobId);

        if (statusErr || !statusRows) continue;

        const counts = statusRows.reduce((acc, r) => {
          const s = r.enrichment_status;
          if (s === 'matched') acc.matched += 1;
          else if (s === 'review') acc.review += 1;
          else if (s === 'failed') acc.failed += 1;
          else if (s === 'applied' || s === 'skipped' || s === 'skipped_existing') acc.skipped += 1;
          return acc;
        }, { matched: 0, review: 0, failed: 0, skipped: 0 });

        await supabase
          .from('website_enrichment_jobs')
          .update({
            matched_rows: counts.matched,
            review_rows: counts.review,
            failed_rows: counts.failed,
            skipped_rows: counts.skipped,
            processed_rows: counts.matched + counts.review + counts.failed + counts.skipped,
            last_activity_at: nowIso,
          })
          .eq('id', affectedJobId);
      }

      return respond({ ok: true, cleaned, scanned, jobs_recounted: [...affectedJobIds], job_id: jobId || null });
    }

    // === APPLY APPROVED (website + city + country) ===
    if (action === 'apply_approved') {
      const jobId = body.job_id;
      const forceOverwrite = body.force_overwrite === true;
      const includeReview = body.include_review === true;
      const runAll = body.run_all === true;
      if (!jobId) return respond({ ok: false, error: 'job_id required' }, 400);

      let applied = 0, skipped = 0, cityFilled = 0, countryFilled = 0, partialApplied = 0;
      const errors: string[] = [];
      const BATCH_SIZE = Math.max(10, Math.min(Number(body.batch_size) || 200, 500));
      const fullStatuses = includeReview ? ['matched', 'approved', 'review'] : ['matched', 'approved'];
      const partialStatuses = includeReview ? ['partial', 'approved', 'review'] : ['partial', 'approved'];

      // Helper: process one batch cycle (returns remaining count)
      async function processOneBatch(): Promise<number> {
        const nowIso = new Date().toISOString();

        // Phase 1: Apply rows that have website candidates
        const { data: fullRows } = await supabase.from('website_enrichment_rows')
          .select('id, university_id, enrichment_status, official_website_url, official_website_domain, match_source, confidence_score, matched_city, matched_country, country_code')
          .eq('job_id', jobId)
          .in('enrichment_status', fullStatuses)
          .not('official_website_url', 'is', null)
          .neq('official_website_url', '')
          .order('id')
          .limit(BATCH_SIZE);

        for (const row of (fullRows || [])) {
          const reviewMeta = includeReview && row.enrichment_status === 'review'
            ? {
                needs_manual_review: false,
                review_action: 'approve',
                reviewed_at: nowIso,
                review_note: 'bulk_apply_include_review',
              }
            : {};

          try {
            const canon = canonicalizeHomepageUrl(row.official_website_url || '');
            const domain = extractDomain(canon.canonical) || row.official_website_domain;
            if (!canon.canonical || !domain) {
              skipped++;
              await supabase
                .from('website_enrichment_rows')
                .update({ enrichment_status: 'skipped_existing', updated_at: nowIso, ...reviewMeta })
                .eq('id', row.id);
              continue;
            }

            const { data: uni } = await supabase.from('universities').select('id, website, city, country_code').eq('id', row.university_id).single();
            if (!uni || (uni.website && !forceOverwrite)) {
              skipped++;
              await supabase
                .from('website_enrichment_rows')
                .update({ enrichment_status: 'skipped_existing', updated_at: nowIso, ...reviewMeta })
                .eq('id', row.id);
              continue;
            }

            const updatePayload: Record<string, any> = {
              website: canon.canonical,
              website_source: row.match_source,
              website_confidence: row.confidence_score ? row.confidence_score / 100 : null,
              website_resolved_at: nowIso,
              website_enrichment_job_id: jobId,
            };
            if (row.matched_city && !uni.city) {
              updatePayload.city = row.matched_city;
              cityFilled++;
            }
            if (row.matched_country && (!uni.country_code || uni.country_code === '')) {
              updatePayload.country_code = row.matched_country.toUpperCase();
              countryFilled++;
            }

            const { error } = await supabase.from('universities').update(updatePayload).eq('id', row.university_id);
            if (error) {
              skipped++;
              if (errors.length < 10) errors.push(`${row.university_id}: ${error.message}`);
              await supabase
                .from('website_enrichment_rows')
                .update({ enrichment_status: 'skipped_existing', updated_at: nowIso, ...reviewMeta })
                .eq('id', row.id);
            } else {
              applied++;
              await supabase
                .from('website_enrichment_rows')
                .update({ enrichment_status: 'applied', updated_at: nowIso, ...reviewMeta })
                .eq('id', row.id);
            }
          } catch {
            skipped++;
            await supabase
              .from('website_enrichment_rows')
              .update({ enrichment_status: 'skipped_existing', updated_at: nowIso, ...reviewMeta })
              .eq('id', row.id);
          }
        }

        // Phase 2: Apply city/country-only rows (no website)
        const { data: partialRows } = await supabase.from('website_enrichment_rows')
          .select('id, university_id, enrichment_status, matched_city, matched_country, official_website_url')
          .eq('job_id', jobId)
          .in('enrichment_status', partialStatuses)
          .or('official_website_url.is.null,official_website_url.eq.')
          .order('id')
          .limit(BATCH_SIZE);

        for (const row of (partialRows || [])) {
          const reviewMeta = includeReview && row.enrichment_status === 'review'
            ? {
                needs_manual_review: false,
                review_action: 'approve',
                reviewed_at: nowIso,
                review_note: 'bulk_apply_include_review',
              }
            : {};

          try {
            const { data: uni } = await supabase.from('universities').select('id, city, country_code').eq('id', row.university_id).single();
            if (!uni) continue;

            const updatePayload: Record<string, any> = {};
            if (row.matched_city && !uni.city) {
              updatePayload.city = row.matched_city;
              cityFilled++;
            }
            if (row.matched_country && (!uni.country_code || uni.country_code === '')) {
              updatePayload.country_code = row.matched_country.toUpperCase();
              countryFilled++;
            }

            if (Object.keys(updatePayload).length > 0) {
              const { error } = await supabase.from('universities').update(updatePayload).eq('id', row.university_id);
              if (!error) partialApplied++;
            }

            await supabase
              .from('website_enrichment_rows')
              .update({ enrichment_status: 'applied', updated_at: nowIso, ...reviewMeta })
              .eq('id', row.id);
          } catch {
            // continue
          }
        }

        // Check remaining
        const { count: moreFullCount } = await supabase.from('website_enrichment_rows')
          .select('id', { count: 'exact', head: true })
          .eq('job_id', jobId)
          .in('enrichment_status', fullStatuses)
          .not('official_website_url', 'is', null)
          .neq('official_website_url', '');

        const { count: morePartialCount } = await supabase.from('website_enrichment_rows')
          .select('id', { count: 'exact', head: true })
          .eq('job_id', jobId)
          .in('enrichment_status', partialStatuses)
          .or('official_website_url.is.null,official_website_url.eq.');

        return (moreFullCount || 0) + (morePartialCount || 0);
      }

      // run_all mode: loop server-side until done (max 50 iterations to avoid timeout)
      if (runAll) {
        const MAX_ITERATIONS = 50;
        let remaining = 1;
        let iterations = 0;
        while (remaining > 0 && iterations < MAX_ITERATIONS) {
          remaining = await processOneBatch();
          iterations++;
        }
        return respond({
          ok: true,
          include_review: includeReview,
          applied,
          skipped,
          partial_applied: partialApplied,
          city_filled: cityFilled,
          country_filled: countryFilled,
          done: remaining === 0,
          remaining,
          iterations,
          errors: errors.length > 0 ? errors : undefined,
        });
      }

      // Single batch mode (legacy)
      const totalRemaining = await processOneBatch();

      return respond({
        ok: true,
        include_review: includeReview,
        applied,
        skipped,
        partial_applied: partialApplied,
        city_filled: cityFilled,
        country_filled: countryFilled,
        done: totalRemaining === 0,
        remaining: totalRemaining,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    // === TICK (cron/auto-tick) ===
    const { data: runningJobs } = await supabase.from('website_enrichment_jobs')
      .select('id, batch_size').eq('status', 'running').order('created_at').limit(1);

    if (!runningJobs || runningJobs.length === 0)
      return respond({ ok: true, message: 'No running jobs' });

    const job = runningJobs[0];
    const leaseOwner = `tick-${crypto.randomUUID().slice(0, 8)}`;
    const { data: leaseAcquired } = await supabase.rpc('rpc_we_claim_tick_lease', {
      p_job_id: job.id, p_owner: leaseOwner, p_ttl_seconds: 90,
    });
    if (!leaseAcquired) return respond({ ok: true, message: 'Tick lease held', job_id: job.id });

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    try {
      const workerPromises = Array.from({ length: 3 }, () =>
        fetch(`${SUPABASE_URL}/functions/v1/website-enrich-worker`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({ job_id: job.id, batch_size: job.batch_size }),
        }).then(r => r.json()).catch(e => ({ error: String(e) }))
      );
      const workerResults = await Promise.all(workerPromises);
      return respond({ ok: true, job_id: job.id, workers: workerResults });
    } finally {
      await supabase.rpc('rpc_we_release_tick_lease', { p_job_id: job.id, p_owner: leaseOwner }).then(() => {}, () => {});
    }

  } catch (err) {
    console.error('[WE-Orchestrator] Fatal:', err);
    return respond({ ok: false, error: String(err) }, 500);
  }
});
