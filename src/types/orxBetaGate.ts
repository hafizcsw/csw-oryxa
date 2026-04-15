/**
 * ORX Beta Launch Gate — Exposure & Enrichment types.
 *
 * Defines the controlled beta exposure model and
 * the entity enrichment facts contract.
 */

// ── Exposure states ──

export type OrxExposureStatus =
  | 'internal_only'
  | 'beta_candidate'
  | 'beta_approved'
  | 'blocked_low_confidence'
  | 'blocked_missing_layer'
  | 'blocked_uncalibrated'
  | 'blocked_external_source_issue';

// ── Transition rules ──

export const ORX_EXPOSURE_TRANSITIONS: Record<OrxExposureStatus, OrxExposureStatus[]> = {
  internal_only:                ['beta_candidate', 'blocked_low_confidence', 'blocked_missing_layer', 'blocked_uncalibrated', 'blocked_external_source_issue'],
  beta_candidate:               ['beta_approved', 'blocked_low_confidence', 'blocked_uncalibrated'],
  beta_approved:                ['blocked_low_confidence', 'internal_only'], // can be revoked
  blocked_low_confidence:       ['internal_only', 'beta_candidate'],
  blocked_missing_layer:        ['internal_only', 'beta_candidate'],
  blocked_uncalibrated:         ['beta_candidate', 'internal_only'],
  blocked_external_source_issue:['internal_only', 'beta_candidate'],
};

/**
 * Requirements for each transition gate:
 *
 * internal_only → beta_candidate:
 *   - status = 'scored'
 *   - confidence ≥ 50
 *   - all 3 layers present (country, university, program scores not null)
 *   - no blocking reasons active
 *
 * beta_candidate → beta_approved:
 *   - calibration_reviewed = true
 *   - calibration_passed = true
 *   - manual sign-off (beta_approved_by set)
 */
export const ORX_BETA_GATE_RULES = {
  to_beta_candidate: {
    min_status: 'scored' as const,
    min_confidence: 50,
    requires_all_layers: true,
    requires_calibration: false,
  },
  to_beta_approved: {
    min_status: 'scored' as const,
    min_confidence: 50,
    requires_all_layers: true,
    requires_calibration: true,
  },
} as const;

// ── Enrichment fact types ──

export type EnrichmentFactStatus =
  | 'candidate'
  | 'approved'
  | 'published'
  | 'rejected'
  | 'stale'
  | 'superseded';

export type EnrichmentFactType =
  | 'accreditation'
  | 'professional_recognition'
  | 'official_handbook'
  | 'official_brochure'
  | 'curriculum_link'
  | 'external_registry'
  | 'notable_program_fact'
  | 'lab_facility'
  | 'official_resource';

export interface EnrichmentFactRow {
  id: string;
  entity_type: 'university' | 'program' | 'country';
  entity_id: string;
  fact_type: EnrichmentFactType;
  fact_key: string;
  fact_value: Record<string, unknown>;
  display_text: string | null;
  source_url: string | null;
  source_domain: string | null;
  source_type: string | null;
  confidence: number | null;
  status: EnrichmentFactStatus;
  evidence_id: string | null;
  first_seen_at: string;
  last_seen_at: string;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Promotion rules ──

/**
 * Evidence → Fact promotion rules:
 *
 * AUTO-PROMOTE (candidate):
 *   - trust_level = 'high'
 *   - source_type in ['accreditation_body', 'government_report', 'official_website']
 *   - extraction_confidence ≥ 50
 *
 * NEEDS REVIEW:
 *   - trust_level = 'medium'
 *   - extraction_confidence 30–49
 *
 * REMAINS ORX-INTERNAL:
 *   - trust_level = 'low'
 *   - contextual_only = true
 *   - extraction_confidence < 30
 *   - signal_family = 'student_value_signal' (subjective)
 */
export const ORX_PROMOTION_RULES = {
  auto_promote_trust_levels: ['high'] as const,
  auto_promote_source_types: ['accreditation_body', 'government_report', 'official_website', 'official_pdf', 'course_catalog'] as const,
  auto_promote_min_confidence: 50,
  review_min_confidence: 30,
  internal_only_families: ['student_value_signal'] as const,
  never_promote_contextual: true,
} as const;

/**
 * Map evidence signal families to enrichment fact types.
 */
export const SIGNAL_TO_FACT_TYPE: Record<string, EnrichmentFactType> = {
  transferability: 'accreditation',
  future_skill_alignment: 'notable_program_fact',
  curriculum_freshness: 'notable_program_fact',
  ai_workflow_exposure: 'lab_facility',
  applied_industry_signal: 'notable_program_fact',
};
