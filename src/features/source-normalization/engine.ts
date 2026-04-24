// ═══════════════════════════════════════════════════════════════
// Source-Side Normalization Engine — Phase A logic (EG, AE, JO).
// ═══════════════════════════════════════════════════════════════
// Scope: 3 countries. No CEFR grading. No descriptive→pct mapping.
// No broad fallbacks. Door 1/2/3 are not consumed here.
// ═══════════════════════════════════════════════════════════════

import type {
  CredentialMappingRule,
  CredentialNamePattern,
  NormalizerDecision,
  NormalizerInput,
  NormalizerOutput,
  NormalizerReasonCode,
  SourceNormalizer,
} from './types';
import { CREDENTIAL_PATTERNS } from './packs/credential-patterns';
import { MAPPING_RULES } from './packs/mapping-rules';

export const NORMALIZER_VERSION = 'phase-a.logic.0.1';

// ── Helpers ─────────────────────────────────────────────────────

function normalizeText(s: string): string {
  return s.trim().toLowerCase();
}

function patternMatches(
  pattern: CredentialNamePattern,
  awardNameRaw: string,
): boolean {
  const hay = normalizeText(awardNameRaw);
  const needle = normalizeText(pattern.match_value);
  switch (pattern.match_kind) {
    case 'exact':
      return hay === needle;
    case 'contains':
      return hay.includes(needle);
    case 'regex':
      try {
        return new RegExp(pattern.match_value, 'i').test(awardNameRaw);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

interface GradeParseResult {
  pct: number | null;
  reason: NormalizerReasonCode | null;
  params: Record<string, unknown>;
}

function parseGrade(
  scoreRaw: string | undefined,
  gradeRaw: string | undefined,
  formulaId: string | undefined,
  scaleId: string | undefined,
): GradeParseResult {
  const raw = (scoreRaw ?? gradeRaw ?? '').trim();
  if (!raw) {
    return {
      pct: null,
      reason: 'grade_unparseable',
      params: { reason: 'empty_grade' },
    };
  }

  // Explicit percentage (e.g. "88%", "85.5%").
  const pctMatch = raw.match(/^(\d+(?:\.\d+)?)\s*%$/);
  if (pctMatch) {
    const v = parseFloat(pctMatch[1]);
    if (formulaId === 'pct_passthrough' || formulaId === 'pct_from_total') {
      return {
        pct: round2(v),
        reason: 'grade_normalized',
        params: { input: raw, formula: 'explicit_pct' },
      };
    }
    return {
      pct: round2(v),
      reason: 'grade_normalized',
      params: { input: raw, formula: 'explicit_pct' },
    };
  }

  // Fraction "380/410".
  const fracMatch = raw.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (fracMatch) {
    const num = parseFloat(fracMatch[1]);
    const den = parseFloat(fracMatch[2]);
    if (den > 0 && formulaId === 'pct_from_total') {
      return {
        pct: round2((num / den) * 100),
        reason: 'grade_normalized',
        params: { input: raw, formula: 'pct_from_total', scale_id: scaleId },
      };
    }
    if (den > 0) {
      return {
        pct: round2((num / den) * 100),
        reason: 'grade_normalized',
        params: { input: raw, formula: 'fraction' },
      };
    }
  }

  // Bare number with no explicit unit — by policy, do NOT assume %.
  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    return {
      pct: null,
      reason: 'grade_unit_missing',
      params: { input: raw },
    };
  }

  // Anything else (descriptive text, transliteration, etc.) — unparseable.
  return {
    pct: null,
    reason: 'grade_unparseable',
    params: { input: raw },
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Ambiguity detectors (rule-bound, narrow) ────────────────────

function detectAmbiguities(
  input: NormalizerInput,
  rule: CredentialMappingRule,
): NormalizerReasonCode[] {
  const codes: NormalizerReasonCode[] = [];
  const trackSignal = `${input.award_name_raw ?? ''} ${input.award_track_raw ?? ''}`;
  const streamSignal = `${input.award_name_raw ?? ''} ${input.award_stream_raw ?? ''}`;

  if (rule.rule_id === 'EG.rule.thanaweya_amma') {
    // Track (scientific/literary) not specified — accepts award_track_raw.
    const hasTrack = /علمي|أدبي|scientific|literary/i.test(trackSignal);
    if (!hasTrack) codes.push('multiple_streams_detected');
  }

  if (rule.rule_id === 'AE.rule.moe_secondary') {
    // Stream advanced/elite not specified — accepts award_stream_raw.
    const hasStream = /advanced|elite|general|متقدم|نخبة|عام/i.test(streamSignal);
    if (!hasStream) codes.push('stream_advanced_vs_elite_unclear');
  }

  if (rule.rule_id === 'JO.rule.tawjihi') {
    // Track academic/vocational not specified — accepts award_track_raw.
    const hasTrack = /academic|vocational|أكاد|مهني/i.test(trackSignal);
    if (!hasTrack) codes.push('track_vocational_vs_academic_unclear');
  }

  return codes;
}

// ── Engine ──────────────────────────────────────────────────────

class PhaseANormalizer implements SourceNormalizer {
  version = NORMALIZER_VERSION;

  normalize(input: NormalizerInput): NormalizerOutput {
    const decisions: NormalizerDecision[] = [];
    const country = input.source_country_code;

    // 1) Pattern matching (filter by country).
    const candidates = CREDENTIAL_PATTERNS.filter(
      (p) => p.source_country_code === country && patternMatches(p, input.award_name_raw),
    );

    if (candidates.length === 0) {
      decisions.push({
        decision_kind: 'pattern_match',
        reason_code: 'no_pattern_match',
        params: { award_name_raw: input.award_name_raw, country },
        evidence_ids: [],
      });
      decisions.push({
        decision_kind: 'review_flag',
        reason_code: 'manual_review_required',
        params: { reason: 'no_pattern_match' },
        evidence_ids: [],
      });
      return {
        student_user_id: input.student_user_id,
        source_country_code: country,
        normalized_credential_kind: 'unknown',
        normalized_credential_subtype: undefined,
        normalized_grade_pct: null,
        normalized_cefr_level: null,
        normalized_language_code: null,
        confidence: 0,
        needs_manual_review: true,
        matched_rule_ids: [],
        evidence_ids: [],
        decisions,
        normalizer_version: this.version,
        trace_id: input.trace_id,
      };
    }

    // Pick highest-confidence pattern.
    const pattern = [...candidates].sort(
      (a, b) => b.confidence_base - a.confidence_base,
    )[0];

    decisions.push({
      decision_kind: 'pattern_match',
      reason_code: 'pattern_matched',
      params: {
        pattern_id: pattern.pattern_id,
        confidence: pattern.confidence_base,
      },
      evidence_ids: pattern.evidence_ids,
    });

    // 2) Find matching rule.
    const rule = MAPPING_RULES.find(
      (r) =>
        r.source_country_code === country &&
        r.applies_when.pattern_ids?.includes(pattern.pattern_id),
    );

    if (!rule) {
      decisions.push({
        decision_kind: 'review_flag',
        reason_code: 'manual_review_required',
        params: { reason: 'no_rule_for_pattern', pattern_id: pattern.pattern_id },
        evidence_ids: [],
      });
      return {
        student_user_id: input.student_user_id,
        source_country_code: country,
        normalized_credential_kind: pattern.maps_to_kind,
        normalized_credential_subtype: pattern.maps_to_subtype,
        normalized_grade_pct: null,
        normalized_cefr_level: null,
        normalized_language_code: null,
        confidence: pattern.confidence_base * 0.5,
        needs_manual_review: true,
        matched_rule_ids: [],
        evidence_ids: pattern.evidence_ids,
        decisions,
        normalizer_version: this.version,
        trace_id: input.trace_id,
      };
    }

    // 3) Grade normalization.
    const grade = parseGrade(
      input.award_score_raw,
      input.award_grade_raw,
      rule.emits.grade_normalization?.formula_id,
      rule.emits.grade_normalization?.from_scale_id,
    );

    if (grade.reason) {
      decisions.push({
        decision_kind: 'grade_norm',
        reason_code: grade.reason,
        params: grade.params,
        matched_rule_id: rule.rule_id,
        evidence_ids: rule.evidence_ids,
      });
    }

    // 4) Ambiguity detection.
    const ambiguityCodes = detectAmbiguities(input, rule);
    for (const code of ambiguityCodes) {
      decisions.push({
        decision_kind: 'review_flag',
        reason_code: code,
        params: {},
        matched_rule_id: rule.rule_id,
        evidence_ids: [],
      });
    }

    // 5) award_year missing flag (only if rule fired and year missing).
    if (input.award_year == null) {
      decisions.push({
        decision_kind: 'review_flag',
        reason_code: 'award_year_missing',
        params: {},
        matched_rule_id: rule.rule_id,
        evidence_ids: [],
      });
    }

    // 6) Manual review aggregation.
    const reviewTriggers = new Set<string>(rule.needs_manual_review_if ?? []);
    const allReasonCodes = decisions.map((d) => d.reason_code);
    const needsReview =
      allReasonCodes.some((c) => reviewTriggers.has(c)) ||
      ambiguityCodes.length > 0 ||
      grade.reason === 'grade_unparseable' ||
      grade.reason === 'grade_unit_missing' ||
      input.award_year == null;

    if (needsReview) {
      decisions.push({
        decision_kind: 'review_flag',
        reason_code: 'manual_review_required',
        params: { triggers: allReasonCodes.filter((c) => c !== 'pattern_matched' && c !== 'grade_normalized') },
        matched_rule_id: rule.rule_id,
        evidence_ids: [],
      });
    }

    const confidence = needsReview
      ? Math.min(0.7, pattern.confidence_base * 0.8)
      : pattern.confidence_base;

    return {
      student_user_id: input.student_user_id,
      source_country_code: country,
      normalized_credential_kind: rule.emits.normalized_kind,
      normalized_credential_subtype: rule.emits.normalized_subtype,
      normalized_grade_pct: grade.pct,
      normalized_cefr_level: null,
      normalized_language_code: null,
      confidence,
      needs_manual_review: needsReview,
      matched_rule_ids: [rule.rule_id],
      evidence_ids: [...pattern.evidence_ids, ...rule.evidence_ids],
      decisions,
      normalizer_version: this.version,
      trace_id: input.trace_id,
    };
  }
}

export const sourceNormalizer: SourceNormalizer = new PhaseANormalizer();
