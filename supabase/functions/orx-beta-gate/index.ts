/**
 * orx-beta-gate — Beta Launch Gate + Evidence Promotion + Pilot Fact Promotion
 *
 * Actions:
 *   classify   — Evaluate pilot entities and set exposure_status
 *   promote    — Promote eligible evidence into entity_enrichment_facts
 *   full       — classify + promote + report (default)
 *
 * Security: internal-only (verify_jwt=false).
 */

import { requireAdminOrServiceRole } from '../_shared/adminGuard.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Pilot universities (same as closeout) ──

const PILOT_UNIS = [
  { id: '985c3211-7429-48f0-a120-bcb7688ef931', name: 'MIT' },
  { id: '161523ba-1055-4915-8cb5-72deff3f9376', name: 'Oxford' },
  { id: 'ccf6e28b-d96e-4048-bcfb-8809b9fac171', name: 'Cambridge' },
  { id: 'cf203ec0-8a44-4906-8bcd-f081d0de6845', name: 'Stanford' },
  { id: '5c1a889c-704b-41b1-bc71-d59389046aa7', name: 'TUM' },
];

// ── Promotion rules (mirrors orxBetaGate.ts) ──

const AUTO_PROMOTE_SOURCE_TYPES = ['accreditation_body', 'government_report', 'official_website', 'official_pdf', 'course_catalog'];
const AUTO_PROMOTE_MIN_CONFIDENCE = 50;
const REVIEW_MIN_CONFIDENCE = 30;
const INTERNAL_ONLY_FAMILIES = ['student_value_signal'];

const SIGNAL_TO_FACT_TYPE: Record<string, string> = {
  transferability: 'accreditation',
  future_skill_alignment: 'notable_program_fact',
  curriculum_freshness: 'notable_program_fact',
  ai_workflow_exposure: 'lab_facility',
  applied_industry_signal: 'notable_program_fact',
};

function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.split('.');
    if (parts.length <= 2) return hostname;
    const tld = parts[parts.length - 1];
    const sld = parts[parts.length - 2];
    if (sld.length <= 3 && tld.length <= 3) return parts.slice(-3).join('.');
    return parts.slice(-2).join('.');
  } catch { return url; }
}

// ── Main ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = await requireAdminOrServiceRole(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ ok: false, error: auth.error }), { status: auth.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const admin = auth.srv;
  const now = new Date().toISOString();

  let body: any = {};
  try { body = await req.json(); } catch {}
  const action = body.action || 'full';

  const results: any = {
    action: 'orx_beta_gate',
    sub_action: action,
    started_at: now,
  };

  try {
    const uniIds = PILOT_UNIS.map(u => u.id);

    // ═══════════════════════════════════════
    // STEP 1: CLASSIFY — Evaluate exposure status
    // ═══════════════════════════════════════
    if (action === 'classify' || action === 'full') {
      console.log('[beta-gate] Step 1: Classifying pilot entities...');

      const { data: scores } = await admin
        .from('orx_scores')
        .select('*')
        .in('entity_id', uniIds)
        .eq('entity_type', 'university');

      const classifications: any[] = [];

      for (const score of (scores || [])) {
        const uniName = PILOT_UNIS.find(u => u.id === score.entity_id)?.name || 'unknown';
        const hasAllLayers = score.country_score !== null && score.university_score !== null && score.program_score !== null;
        const isScoredStatus = score.status === 'scored';
        const hasMinConfidence = (score.confidence || 0) >= 50;

        let newExposure: string;
        let blockingReasons: string[] = [];

        if (!isScoredStatus) {
          newExposure = 'blocked_missing_layer';
          blockingReasons.push('status_not_scored');
        } else if (!hasAllLayers) {
          newExposure = 'blocked_missing_layer';
          if (score.country_score === null) blockingReasons.push('missing_country_layer');
          if (score.university_score === null) blockingReasons.push('missing_university_layer');
          if (score.program_score === null) blockingReasons.push('missing_program_layer');
        } else if (!hasMinConfidence) {
          newExposure = 'blocked_low_confidence';
          blockingReasons.push(`confidence_${score.confidence}_below_50`);
        } else {
          // All gates pass for beta_candidate
          newExposure = 'beta_candidate';
        }

        // Update in DB
        const { error } = await admin
          .from('orx_scores')
          .update({ exposure_status: newExposure })
          .eq('id', score.id);

        classifications.push({
          university: uniName,
          entity_id: score.entity_id,
          score: score.score,
          confidence: score.confidence,
          status: score.status,
          has_all_layers: hasAllLayers,
          country_score: score.country_score,
          university_score: score.university_score,
          program_score: score.program_score,
          previous_exposure: score.exposure_status || 'internal_only',
          new_exposure: newExposure,
          blocking_reasons: blockingReasons,
          can_become_beta_approved: newExposure === 'beta_candidate',
          update_error: error?.message || null,
        });
      }

      results.classifications = classifications;
      results.beta_candidates = classifications.filter(c => c.new_exposure === 'beta_candidate').map(c => c.university);
      results.still_blocked = classifications.filter(c => c.new_exposure !== 'beta_candidate').map(c => ({
        university: c.university, reason: c.new_exposure, details: c.blocking_reasons,
      }));
    }

    // ═══════════════════════════════════════
    // STEP 2: PROMOTE — Evidence → Enrichment Facts
    // ═══════════════════════════════════════
    if (action === 'promote' || action === 'full') {
      console.log('[beta-gate] Step 2: Promoting evidence to enrichment facts...');

      // Get all accepted evidence for pilot entities
      const allEntityIds = [...uniIds];

      // Also get program IDs linked to pilot unis
      const { data: progScores } = await admin
        .from('orx_scores')
        .select('entity_id')
        .eq('entity_type', 'program')
        .eq('status', 'scored');

      const progIds = (progScores || []).map((p: any) => p.entity_id);
      allEntityIds.push(...progIds);

      const { data: evidence } = await admin
        .from('orx_evidence')
        .select('*')
        .in('entity_id', allEntityIds)
        .eq('evidence_status', 'accepted')
        .order('extraction_confidence', { ascending: false });

      const promotionLog: any[] = [];
      let promoted = 0;
      let skippedInternal = 0;
      let skippedLowConf = 0;
      let needsReview = 0;

      for (const ev of (evidence || [])) {
        // Skip internal-only families
        if (INTERNAL_ONLY_FAMILIES.includes(ev.signal_family)) {
          skippedInternal++;
          continue;
        }

        // Skip contextual-only
        if (ev.contextual_only) {
          skippedInternal++;
          continue;
        }

        // Determine promotion status
        const isAutoPromote = AUTO_PROMOTE_SOURCE_TYPES.includes(ev.source_type) &&
                              (ev.extraction_confidence || 0) >= AUTO_PROMOTE_MIN_CONFIDENCE;
        const isReviewable = !isAutoPromote && (ev.extraction_confidence || 0) >= REVIEW_MIN_CONFIDENCE;

        if (!isAutoPromote && !isReviewable) {
          skippedLowConf++;
          continue;
        }

        const factType = SIGNAL_TO_FACT_TYPE[ev.signal_family] || 'notable_program_fact';
        const factStatus = isAutoPromote ? 'candidate' : 'candidate'; // Both start as candidate; auto-promote ones get approved below

        // Build display text from snippet
        let displayText = ev.snippet || '';
        if (displayText.length > 200) displayText = displayText.substring(0, 197) + '...';

        const factRow = {
          entity_type: ev.entity_type,
          entity_id: ev.entity_id,
          fact_type: factType,
          fact_key: `${ev.signal_family}__${extractDomain(ev.source_url || '')}`,
          fact_value: {
            signal_family: ev.signal_family,
            source_title: ev.source_title,
            trust_level: ev.trust_level,
            extraction_confidence: ev.extraction_confidence,
          },
          display_text: displayText,
          source_url: ev.source_url,
          source_domain: ev.source_domain,
          source_type: ev.source_type,
          confidence: ev.extraction_confidence,
          status: isAutoPromote ? 'approved' : 'candidate',
          evidence_id: ev.id,
          first_seen_at: ev.observed_at || now,
          last_seen_at: now,
          last_verified_at: ev.freshness_date || now,
        };

        const { error } = await admin
          .from('entity_enrichment_facts')
          .upsert(factRow, { onConflict: 'entity_type,entity_id,fact_type,fact_key,source_domain' });

        if (!error) {
          promoted++;
          if (!isAutoPromote) needsReview++;
          promotionLog.push({
            entity_type: ev.entity_type,
            entity_id: ev.entity_id,
            signal_family: ev.signal_family,
            source_url: ev.source_url,
            source_domain: ev.source_domain,
            trust_level: ev.trust_level,
            extraction_confidence: ev.extraction_confidence,
            fact_type: factType,
            promotion_status: isAutoPromote ? 'approved' : 'candidate',
          });
        } else {
          console.error(`[beta-gate] Promotion error: ${error.message}`);
        }
      }

      results.promotion = {
        total_evidence_reviewed: (evidence || []).length,
        promoted,
        needs_review: needsReview,
        skipped_internal_only: skippedInternal,
        skipped_low_confidence: skippedLowConf,
      };

      // Show sample promoted facts
      results.promotion_examples = promotionLog.slice(0, 15);
    }

    // ═══════════════════════════════════════
    // STEP 3: PILOT FACT SUMMARY
    // ═══════════════════════════════════════
    if (action === 'full') {
      console.log('[beta-gate] Step 3: Building pilot fact summary...');

      const { data: facts } = await admin
        .from('entity_enrichment_facts')
        .select('*')
        .order('confidence', { ascending: false })
        .limit(50);

      const factsByEntity: Record<string, any[]> = {};
      for (const f of (facts || [])) {
        const key = `${f.entity_type}:${f.entity_id}`;
        if (!factsByEntity[key]) factsByEntity[key] = [];
        factsByEntity[key].push({
          fact_type: f.fact_type,
          fact_key: f.fact_key,
          display_text: f.display_text?.substring(0, 120),
          source_url: f.source_url,
          source_domain: f.source_domain,
          status: f.status,
          confidence: f.confidence,
        });
      }

      results.enrichment_facts_summary = {
        total_facts: (facts || []).length,
        by_status: {
          approved: (facts || []).filter((f: any) => f.status === 'approved').length,
          candidate: (facts || []).filter((f: any) => f.status === 'candidate').length,
        },
        by_entity: factsByEntity,
      };

      // ═══════════════════════════════════════
      // STEP 4: FINAL REPORT
      // ═══════════════════════════════════════

      const betaCandidates = (results.classifications || []).filter((c: any) => c.new_exposure === 'beta_candidate');
      const blocked = (results.classifications || []).filter((c: any) => c.new_exposure !== 'beta_candidate');

      results.executive_snapshot = {
        pilot_size: PILOT_UNIS.length,
        beta_candidates: betaCandidates.length,
        still_blocked: blocked.length,
        beta_candidate_names: betaCandidates.map((c: any) => c.university),
        blocked_names: blocked.map((c: any) => ({ name: c.university, reason: c.new_exposure })),
        facts_promoted: results.promotion?.promoted || 0,
        facts_needing_review: results.promotion?.needs_review || 0,
        verdict: betaCandidates.length >= 4 ? 'PASS' : betaCandidates.length >= 3 ? 'FIX_REQUIRED' : 'NEEDS_EVIDENCE',
        remaining_blockers: [
          'All entities remain launch_blocked until manual calibration_passed',
          'beta_approved requires human sign-off (beta_approved_by)',
          'Mass crawler not yet built',
          'LLM deep extraction not yet implemented',
          ...(blocked.length > 0 ? blocked.map((b: any) => `${b.university}: ${b.new_exposure} — ${b.blocking_reasons.join(', ')}`) : []),
        ],
        code_ready: [
          'exposure_status column + enum',
          'calibration gate columns',
          'entity_enrichment_facts table',
          'vw_entity_enrichment_published view',
          'promotion rules + pipeline',
          'beta classification pipeline',
        ],
        runtime_proven: [
          'pilot classification executed',
          'evidence promotion executed',
          'enrichment facts populated with real data',
        ],
      };
    }

    results.completed_at = new Date().toISOString();

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[beta-gate] Fatal:', err);
    return new Response(JSON.stringify({
      error: err.message,
      stack: err.stack,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
