// ═══════════════════════════════════════════════════════════════
// Phase A — Source-Side Normalization Engine
// ═══════════════════════════════════════════════════════════════
// Scope: 3 source countries (EG, AE, JO). Skeleton only.
// Engine logic NOT implemented — types + contracts only.
// Door 1/2/3 are FROZEN and not consumed here.
// ═══════════════════════════════════════════════════════════════

export type SourceCountryCode = 'EG' | 'AE' | 'JO';

export const SOURCE_COUNTRIES: SourceCountryCode[] = ['EG', 'AE', 'JO'];

// ── Normalized credential output ─────────────────────────────

export type NormalizedCredentialKind =
  | 'secondary_general'
  | 'secondary_vocational'
  | 'secondary_technical'
  | 'language_test'
  | 'unknown';

export interface NormalizedGrade {
  grade_pct: number | null;          // 0..100
  raw_grade: string;                 // as reported
  scale_basis: string;               // e.g. "EG_thanaweya_total_410"
}

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

// ── Reference pack: country profile ──────────────────────────

export interface CountryEducationProfile {
  country_code: SourceCountryCode;
  country_name_en: string;
  primary_local_language: string;     // ISO lang code
  secondary_system_summary: string;
  grading_scale: {
    scale_id: string;
    max_value: number;
    pass_threshold_pct: number;
    notes?: string;
  }[];
  evidence_ids: string[];             // pointers into pack evidence
}

// ── Reference pack: credential name patterns ─────────────────

export interface CredentialNamePattern {
  pattern_id: string;
  source_country_code: SourceCountryCode;
  match_kind: 'exact' | 'contains' | 'regex';
  match_value: string;
  match_language: string;             // ISO lang code (e.g. 'ar', 'en')
  maps_to_kind: NormalizedCredentialKind;
  maps_to_subtype?: string;
  confidence_base: number;            // 0..1
  evidence_ids: string[];
}

// ── Reference pack: language test → CEFR mapping ─────────────

export interface LanguageTestCefrMapping {
  mapping_id: string;
  test_name: string;                  // e.g. "IELTS_academic", "TOEFL_iBT"
  language_code: string;              // ISO lang code being tested
  bands: Array<{
    score_min: number;
    score_max: number;
    cefr: CefrLevel;
  }>;
  evidence_ids: string[];
}

// ── Reference pack: mapping rule ─────────────────────────────

export interface CredentialMappingRule {
  rule_id: string;
  source_country_code: SourceCountryCode;
  applies_when: {
    pattern_ids?: string[];
    award_year_min?: number;
    award_year_max?: number;
  };
  emits: {
    normalized_kind: NormalizedCredentialKind;
    normalized_subtype?: string;
    grade_normalization?: {
      from_scale_id: string;
      formula_id: string;             // declarative formula reference
    };
  };
  needs_manual_review_if?: string[];  // condition codes
  priority: number;                   // higher wins
  evidence_ids: string[];
}

// ── Engine input/output ──────────────────────────────────────

export interface NormalizerInput {
  student_user_id: string;
  source_country_code: SourceCountryCode;
  award_name_raw: string;
  award_year?: number;
  award_grade_raw?: string;
  award_score_raw?: string;
  /**
   * Explicit track signal (EG/JO): e.g. 'scientific' | 'literary' | 'academic' | 'vocational'.
   * Free-text accepted (Arabic or English). When present, ambiguity detectors
   * for track-based rules (EG.thanaweya_amma, JO.tawjihi) treat the track as resolved.
   */
  award_track_raw?: string;
  /**
   * Explicit stream signal (AE): e.g. 'advanced' | 'elite' | 'general'.
   * Free-text accepted (Arabic or English). When present, the AE.moe_secondary
   * stream-ambiguity detector treats the stream as resolved.
   */
  award_stream_raw?: string;
  language_signals?: Array<{
    test_name: string;
    score: number;
  }>;
  trace_id?: string;
}

export type NormalizerReasonCode =
  | 'pattern_matched'
  | 'no_pattern_match'
  | 'no_pattern_matched'
  | 'multiple_patterns_tied'
  | 'grade_normalized'
  | 'grade_unparseable'
  | 'grade_unit_missing'
  | 'language_cefr_mapped'
  | 'language_score_out_of_range'
  | 'manual_review_required'
  | 'country_profile_missing'
  | 'multiple_streams_detected'
  | 'stream_advanced_vs_elite_unclear'
  | 'track_vocational_vs_academic_unclear'
  | 'award_year_missing';

export interface NormalizerDecision {
  decision_kind: 'pattern_match' | 'grade_norm' | 'language_map' | 'review_flag';
  reason_code: NormalizerReasonCode;
  params: Record<string, unknown>;
  matched_rule_id?: string;
  evidence_ids: string[];
}

export interface NormalizerOutput {
  student_user_id: string;
  source_country_code: SourceCountryCode;
  normalized_credential_kind: NormalizedCredentialKind;
  normalized_credential_subtype?: string;
  normalized_grade_pct: number | null;
  normalized_cefr_level: CefrLevel | null;
  normalized_language_code: string | null;
  confidence: number;
  needs_manual_review: boolean;
  matched_rule_ids: string[];
  evidence_ids: string[];
  decisions: NormalizerDecision[];
  normalizer_version: string;
  trace_id?: string;
}

// ── Engine contract ──────────────────────────────────────────

export interface SourceNormalizer {
  version: string;
  normalize(input: NormalizerInput): NormalizerOutput;
}
