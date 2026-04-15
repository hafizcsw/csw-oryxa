/**
 * publish-qs-programmes
 * 
 * Publishes all QS programme data from qs_programme_details → programs table.
 * Maps entity_profile_id → university_id via slug matching.
 * 
 * POST { dry_run?: boolean, limit?: number, entity_profile_id?: string }
 */
import { handleCorsPreflight, getCorsHeaders, generateTraceId, slog } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/adminGuard.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin);
  const tid = req.headers.get("x-client-trace-id") || generateTraceId();

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return json({ ok: false, error: auth.error, trace_id: tid }, auth.status, cors);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const srv = createClient(SUPABASE_URL, SRV_KEY);

  try {
    // ══════════════════════════════════════════════════════════════════════
    // HARD FREEZE — Phase 1 Safety Repair (2026-03-18)
    // This function is FROZEN. QS is removed from active publish paths.
    // No writes to `programs` table from QS source.
    // Freeze reason: official-site-only lane policy.
    // ══════════════════════════════════════════════════════════════════════
    slog({ tid, level: "warn", action: "FROZEN_publish_qs_programmes", reason: "phase1_official_site_only_freeze" });
    await srv.from("pipeline_health_events").insert({
      pipeline: "qs_publish_programmes",
      event_type: "freeze",
      metric: "hard_freeze_block",
      value: 1,
      details_json: { trace_id: tid, frozen_at: new Date().toISOString(), reason: "phase1_official_site_only" },
    }).then(() => {}).catch(() => {});
    return json({ ok: false, frozen: true, reason: "phase1_official_site_only_freeze", trace_id: tid }, 200, cors);

    // === FROZEN CODE BELOW — unreachable ===
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;
    const limit = Math.min(body.limit || 5000, 5000);
    const filterEntityId = body.entity_profile_id || null;

    // Step 1: Build entity_profile_id → university_id mapping
    let epQuery = srv
      .from("qs_entity_profiles")
      .select("id, qs_slug, name");

    if (filterEntityId) {
      epQuery = epQuery.eq("id", filterEntityId);
    }

    const { data: profiles, error: epErr } = await epQuery;
    if (epErr) throw epErr;

    // Match to universities table
    const { data: unis } = await srv
      .from("universities")
      .select("id, slug, name");

    const uniMap = new Map<string, string>(); // entity_profile_id → university_id

    for (const ep of profiles || []) {
      const match = (unis || []).find(u => {
        if (!u.slug && !u.name) return false;
        // Direct slug match
        if (u.slug === ep.qs_slug) return true;
        // Slug with "of"/"the" inserted (common pattern)
        const normalizedQs = ep.qs_slug?.replace(/-/g, ' ').toLowerCase() || '';
        const normalizedUni = (u.slug || '').replace(/-/g, ' ').toLowerCase();
        if (normalizedQs === normalizedUni) return true;
        // Name match (strip markdown)
        const cleanUniName = (u.name || '').replace(/\*/g, '').trim().toLowerCase();
        const epName = (ep.name || '').toLowerCase();
        if (cleanUniName === epName) return true;
        // Contains match: uni name contains QS name or vice versa (handles "AURAK" suffix)
        if (cleanUniName.includes(epName) || epName.includes(cleanUniName)) return true;
        return false;
      });

      if (match) {
        uniMap.set(ep.id, match.id);
      }
    }

    slog({ tid, level: "info", action: "mapping_complete", mapped: uniMap.size, total_profiles: profiles?.length });

    // Step 2: Fetch all programmes
    let progQuery = srv
      .from("qs_programme_details")
      .select("*")
      .limit(limit);

    if (filterEntityId) {
      progQuery = progQuery.eq("entity_profile_id", filterEntityId);
    }

    const { data: programmes, error: progErr } = await progQuery;
    if (progErr) throw progErr;

    // Step 3: Map and prepare for insert
    const toPublish: any[] = [];
    const skipped: { reason: string; url: string }[] = [];

    for (const p of programmes || []) {
      const universityId = uniMap.get(p.entity_profile_id);
      if (!universityId) {
        skipped.push({ reason: "no_university_match", url: p.programme_url });
        continue;
      }

      if (!p.title || p.title.trim() === '') {
        skipped.push({ reason: "no_title", url: p.programme_url });
        continue;
      }

      // Map level → degree_level
      const degreeLevel = mapDegreeLevel(p.level, p.degree);

      // Parse duration
      const durationMonths = parseDuration(p.duration);

      // Map study_mode
      const studyMode = mapStudyMode(p.study_mode);

      // Parse start_months to intake_months
      const intakeMonths = p.start_months || null;

      // Currency and tuition
      const currency = p.tuition_currency || 'GBP';
      const tuitionYearly = p.tuition_international ?? p.tuition_domestic ?? null;

      // Generate fingerprint for dedup
      const fingerprint = `qs:${p.programme_url}`;

      toPublish.push({
        university_id: universityId,
        title: p.title,
        degree_level: degreeLevel,
        language: 'EN',
        languages: ['EN'],
        delivery_mode: studyMode === 'online' ? 'Online' : 'On Campus',
        study_mode: studyMode,
        duration_months: durationMonths,
        tuition_yearly: tuitionYearly,
        currency_code: currency,
        intake_months: intakeMonths,
        source_program_url: p.programme_url,
        fingerprint: fingerprint,
        publish_status: 'published',
        published: true,
      });
    }

    if (dryRun) {
      return json({
        ok: true,
        dry_run: true,
        total_programmes: programmes?.length || 0,
        mapped_universities: uniMap.size,
        to_publish: toPublish.length,
        skipped_count: skipped.length,
        skipped_sample: skipped.slice(0, 20),
        sample: toPublish.slice(0, 10).map(p => ({
          title: p.title,
          university_id: p.university_id,
          degree_level: p.degree_level,
          tuition_yearly: p.tuition_yearly,
        })),
        trace_id: tid,
      }, 200, cors);
    }

    // Step 4: Upsert in chunks
    const chunkSize = 50;
    let inserted = 0;
    let updated = 0;
    let failed = 0;
    const errors: any[] = [];

    for (let i = 0; i < toPublish.length; i += chunkSize) {
      const chunk = toPublish.slice(i, i + chunkSize);

      const { data: result, error: upsertErr } = await srv
        .from("programs")
        .upsert(chunk, {
          onConflict: "fingerprint",
          ignoreDuplicates: false,
        })
        .select("id");

      if (upsertErr) {
        // If fingerprint column doesn't exist or conflict fails, try insert
        failed += chunk.length;
        errors.push({ chunk: i, error: upsertErr.message });

        // Fallback: insert one by one, skip duplicates
        for (const item of chunk) {
          const { error: singleErr } = await srv
            .from("programs")
            .insert(item);

          if (singleErr) {
            if (singleErr.message?.includes('duplicate') || singleErr.message?.includes('unique')) {
              // Already exists, try update
              const { error: updateErr } = await srv
                .from("programs")
                .update(item)
                .eq("source_program_url", item.source_program_url)
                .eq("university_id", item.university_id);

              if (!updateErr) {
                updated++;
                failed--;
              }
            }
          } else {
            inserted++;
            failed--;
          }
        }
      } else {
        inserted += result?.length || chunk.length;
      }
    }

    // Telemetry (ignore errors)
    try {
      await srv.from("pipeline_health_events").insert({
        pipeline: "qs_publish_programmes",
        event_type: "metric",
        metric: "bulk_publish",
        value: inserted + updated,
        details_json: {
          trace_id: tid,
          inserted,
          updated,
          failed,
          skipped: skipped.length,
          total_attempted: toPublish.length,
        },
      });
    } catch (_) { /* ignore */ }

    slog({ tid, level: "info", action: "publish_complete", inserted, updated, failed, skipped: skipped.length });

    return json({
      ok: true,
      inserted,
      updated,
      failed,
      skipped: skipped.length,
      total_attempted: toPublish.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      trace_id: tid,
    }, 200, cors);

  } catch (err: any) {
    slog({ tid, level: "error", action: "publish_error", error: String(err) });
    return json({ ok: false, error: err?.message, trace_id: tid }, 500, cors);
  }
});

function mapDegreeLevel(level: string | null, degree: string | null): string {
  const l = (level || '').toLowerCase();
  const d = (degree || '').toLowerCase();

  if (l === 'phd' || l === 'doctoral' || d.includes('phd') || d.includes('dphil')) return 'PhD';
  if (l === 'masters' || l === 'postgrad') {
    if (d.includes('mba')) return 'MBA';
    if (d.startsWith('msc') || d.startsWith('m.sc')) return 'MSc';
    if (d.startsWith('ma') || d === 'ma') return 'MA';
    if (d.startsWith('mphil')) return 'MPhil';
    if (d.startsWith('mst')) return 'MSt';
    if (d.startsWith('llm')) return 'LLM';
    return 'Masters';
  }
  if (l === 'undergraduate' || l === 'undergrad') {
    if (d.includes('b.a') || d === 'ba') return 'B.A.';
    if (d.includes('b.sc') || d === 'bsc') return 'BSc';
    if (d.includes('llb')) return 'LLB';
    return 'Bachelor';
  }
  if (l === 'mba' || d === 'mba') return 'MBA';
  return degree || level || 'Other';
}

function parseDuration(d: string | null): number | null {
  if (!d) return null;
  const lower = d.toLowerCase();
  // "36 months", "3 years", "1 year", "12 months"
  const monthMatch = lower.match(/(\d+)\s*month/);
  if (monthMatch) return parseInt(monthMatch[1]);
  const yearMatch = lower.match(/(\d+)\s*year/);
  if (yearMatch) return parseInt(yearMatch[1]) * 12;
  // Just a number
  const numMatch = lower.match(/^(\d+)$/);
  if (numMatch) return parseInt(numMatch[1]);
  return null;
}

function mapStudyMode(sm: string | null): string | null {
  if (!sm) return null;
  const lower = sm.toLowerCase();
  if (lower.includes('full') && lower.includes('time')) return 'full_time';
  if (lower.includes('part') && lower.includes('time')) return 'part_time';
  if (lower.includes('online')) return 'online';
  return sm;
}

function json(data: any, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
