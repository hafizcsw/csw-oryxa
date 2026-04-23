// ═══════════════════════════════════════════════════════════════
// Door 3 — Measurement-lite layer
// ═══════════════════════════════════════════════════════════════
// Pure, additive snapshot. No DB dependency. No scoring inflation.
// In scope:   CLUS, EIUS, LPUS-basic
// Out of scope (intentional placeholders, non-governing):
//   APUS_full, ISUS_full, CCUS_full
// ═══════════════════════════════════════════════════════════════
import type { ApplicantTruth } from './applicant-normalize';
import type { CountryMatrix } from './types';

export const MEASUREMENT_VERSION = '2026.04-lite-v1';

// ── Sub-payloads ─────────────────────────────────────────────

export interface ClusPayload {
  qualification_present: boolean;
  qualification_kind: string | null;
  stage_standing: 'completed' | 'in_progress' | 'unknown';
  progression_standing: 'on_track' | 'gap_present' | 'unknown';
  grade_band: 'high' | 'mid' | 'low' | 'unknown'; // ≥80 / 65–79 / <65
  confidence: number; // 0..1
}

export interface EiusPayload {
  evidence_completeness: number;     // 0..1 — fraction of core truth fields present
  consistency_ok: boolean;
  flags: Array<{ code: string; severity: 'info' | 'warn' | 'critical' }>;
  flags_severity_max: 'none' | 'info' | 'warn' | 'critical';
}

export interface LpusBasicPayload {
  english_signal_present: boolean;
  english_band: 'strong' | 'mid' | 'weak' | 'none';   // strong ≥6.5, mid 5.5–6.4, weak <5.5
  exemption_signal: boolean;                          // medium-of-instruction or majority-EN
  local_language_signals_count: number;
}

// Non-governing placeholders — present so consumers know schema-shape is reserved.
export interface PlaceholderPayload {
  reserved: true;
  note: string;
}

export type ProfileTier = 'A' | 'B' | 'C' | 'D';

export interface MeasurementSnapshot {
  application_measurement_snapshot_id: string;
  measurement_version: string;
  clus_payload: ClusPayload;
  eius_payload: EiusPayload;
  lpus_payload: LpusBasicPayload;
  // reserved future axes — non-governing
  apus_payload: PlaceholderPayload;
  isus_payload: PlaceholderPayload;
  ccus_payload: PlaceholderPayload;
  overall_profile_tier: ProfileTier;
  confidence_summary: number; // 0..1
  computed_at: string;
  computation_trace_id: string;
}

// ── Helpers ──────────────────────────────────────────────────

function gradeBand(pct: number | null): ClusPayload['grade_band'] {
  if (pct == null) return 'unknown';
  if (pct >= 80) return 'high';
  if (pct >= 65) return 'mid';
  return 'low';
}

function englishBand(score: number | null): LpusBasicPayload['english_band'] {
  if (score == null || score <= 0) return 'none';
  // normalized to IELTS-equivalent thresholds
  if (score >= 6.5) return 'strong';
  if (score >= 5.5) return 'mid';
  return 'weak';
}

function buildClus(t: ApplicantTruth): ClusPayload {
  const present = t.secondary_kind != null || t.secondary_completed;
  const stage_standing: ClusPayload['stage_standing'] = t.secondary_completed
    ? 'completed'
    : present
      ? 'in_progress'
      : 'unknown';
  const progression_standing: ClusPayload['progression_standing'] =
    stage_standing === 'completed'
      ? 'on_track'
      : stage_standing === 'in_progress'
        ? 'gap_present'
        : 'unknown';

  // confidence reflects how well CLUS could be derived
  let conf = 0;
  if (t.secondary_kind) conf += 0.4;
  if (t.secondary_completed) conf += 0.3;
  if (t.secondary_grade_pct != null) conf += 0.3;

  return {
    qualification_present: present,
    qualification_kind: t.secondary_kind,
    stage_standing,
    progression_standing,
    grade_band: gradeBand(t.secondary_grade_pct),
    confidence: Math.min(1, Math.round(conf * 100) / 100),
  };
}

function buildEius(t: ApplicantTruth): EiusPayload {
  const coreFields: Array<[string, unknown]> = [
    ['citizenship', t.citizenship],
    ['secondary_completed', t.secondary_completed],
    ['secondary_kind', t.secondary_kind],
    ['secondary_grade_pct', t.secondary_grade_pct],
    ['english_test_type', t.english_test_type],
    ['english_total_score', t.english_total_score],
  ];
  const present = coreFields.filter(([, v]) => v != null && v !== '').length;
  const completeness = Math.round((present / coreFields.length) * 100) / 100;

  const flags: EiusPayload['flags'] = [];

  if (!t.citizenship) {
    flags.push({ code: 'citizenship_missing', severity: 'critical' });
  }
  if (t.secondary_completed && t.secondary_grade_pct == null) {
    flags.push({ code: 'grade_missing_for_completed_secondary', severity: 'warn' });
  }
  if (t.english_test_type && t.english_test_type !== 'none' && t.english_total_score == null) {
    flags.push({ code: 'english_test_type_without_score', severity: 'warn' });
  }
  if (!t.english_test_type && !t.majority_english_country && !t.english_medium_secondary) {
    flags.push({ code: 'no_english_signal', severity: 'info' });
  }

  // consistency: completed secondary should not have null kind AND null grade together
  const consistency_ok = !(t.secondary_completed && t.secondary_kind == null && t.secondary_grade_pct == null);

  const sevRank = { none: 0, info: 1, warn: 2, critical: 3 } as const;
  let maxSev: EiusPayload['flags_severity_max'] = 'none';
  for (const f of flags) {
    if (sevRank[f.severity] > sevRank[maxSev]) maxSev = f.severity;
  }

  return {
    evidence_completeness: completeness,
    consistency_ok,
    flags,
    flags_severity_max: maxSev,
  };
}

function buildLpus(t: ApplicantTruth): LpusBasicPayload {
  const present = !!t.english_test_type && t.english_test_type !== 'none' && t.english_total_score != null;
  return {
    english_signal_present: present,
    english_band: englishBand(t.english_total_score),
    exemption_signal: t.english_medium_secondary || t.majority_english_country,
    local_language_signals_count: t.local_language_signals?.length ?? 0,
  };
}

function tierFrom(clus: ClusPayload, eius: EiusPayload, lpus: LpusBasicPayload): ProfileTier {
  // Simple, transparent banding — additive only.
  let score = 0;
  if (clus.stage_standing === 'completed') score += 2;
  else if (clus.stage_standing === 'in_progress') score += 1;
  if (clus.grade_band === 'high') score += 2;
  else if (clus.grade_band === 'mid') score += 1;
  if (lpus.english_band === 'strong' || lpus.exemption_signal) score += 2;
  else if (lpus.english_band === 'mid') score += 1;
  if (eius.evidence_completeness >= 0.8 && eius.consistency_ok) score += 1;
  if (eius.flags_severity_max === 'critical') score -= 2;

  if (score >= 6) return 'A';
  if (score >= 4) return 'B';
  if (score >= 2) return 'C';
  return 'D';
}

function confidenceSummary(clus: ClusPayload, eius: EiusPayload): number {
  const v = (clus.confidence * 0.5) + (eius.evidence_completeness * 0.5);
  return Math.round(v * 100) / 100;
}

// ── Main API ─────────────────────────────────────────────────

export function buildMeasurementSnapshot(
  truth: ApplicantTruth,
  trace_id?: string,
): MeasurementSnapshot {
  const clus = buildClus(truth);
  const eius = buildEius(truth);
  const lpus = buildLpus(truth);

  return {
    application_measurement_snapshot_id: `ams_${truth.student_id}_${Date.now()}`,
    measurement_version: MEASUREMENT_VERSION,
    clus_payload: clus,
    eius_payload: eius,
    lpus_payload: lpus,
    apus_payload: { reserved: true, note: 'APUS_full deferred — placeholder only' },
    isus_payload: { reserved: true, note: 'ISUS_full deferred — placeholder only' },
    ccus_payload: { reserved: true, note: 'CCUS_full deferred — placeholder only' },
    overall_profile_tier: tierFrom(clus, eius, lpus),
    confidence_summary: confidenceSummary(clus, eius),
    computed_at: new Date().toISOString(),
    computation_trace_id: trace_id ?? `trace_${crypto.randomUUID?.() ?? Date.now()}`,
  };
}

// ── Top blockers/gaps extractor (matrix-aware, presentation-only) ──

export interface TopBlocker {
  country_code: string;
  reason_code: string;
  severity: 'gap' | 'blocker';
  matched_rule_id: string;
  evidence_ids: string[];
}

export function extractTopBlockers(matrix: CountryMatrix, limit = 10): TopBlocker[] {
  const out: TopBlocker[] = [];
  for (const r of matrix.results) {
    for (const b of r.blockers) {
      out.push({
        country_code: r.country_code,
        reason_code: b.reason_code,
        severity: 'blocker',
        matched_rule_id: b.matched_rule_id,
        evidence_ids: b.evidence_ids,
      });
    }
    for (const g of r.blocking_gaps) {
      out.push({
        country_code: r.country_code,
        reason_code: g.reason_code,
        severity: 'gap',
        matched_rule_id: g.matched_rule_id,
        evidence_ids: g.evidence_ids,
      });
    }
  }
  return out.slice(0, limit);
}
