/**
 * ORX RANK Methodology v1.1 — Machine-Friendly Config
 *
 * Tightened pre-scoring contract. Adds discipline families, source
 * independence, stricter status thresholds, third-party index guardrails,
 * student signal cap, and provisional weight marking.
 *
 * NO scoring logic here. This is the CONTRACT only.
 */

// ── Version ──

export const ORX_METHODOLOGY_VERSION = '1.1' as const;
export const ORX_METHODOLOGY_DATE = '2026-03-15' as const;

// ── Layer Weights (PROVISIONAL — pending calibration testing) ──

export const ORX_LAYER_WEIGHTS = {
  country: 0.20,
  university: 0.35,
  program: 0.45,
} as const;

/**
 * These weights are provisional v1.1 values.
 * They MUST be calibrated against real scored entities before
 * production scoring begins. Do not treat as final.
 */
export const ORX_WEIGHTS_STATUS = 'provisional_pending_calibration' as const;

export type OrxLayer = keyof typeof ORX_LAYER_WEIGHTS;

// ── Discipline Families ──

/**
 * ORX-P interpretation varies by discipline family.
 * The same signal families apply, but their relative importance
 * and evidence interpretation differ per discipline.
 * Full discipline rubrics are NOT yet defined — this is the scaffold.
 */
export const ORX_DISCIPLINE_FAMILIES = [
  'computing_ai_data',
  'engineering',
  'business_finance',
  'health_medicine',
  'law_policy',
  'design_media',
  'education',
  'social_sciences',
] as const;

export type OrxDisciplineFamily = typeof ORX_DISCIPLINE_FAMILIES[number];

/**
 * Discipline-specific weight overrides (future).
 * When populated, these override ORX_SIGNALS_PROGRAM weights
 * for programs in the given discipline family.
 * Empty for v1.1 — scaffold only.
 */
export const ORX_DISCIPLINE_WEIGHT_OVERRIDES: Partial<
  Record<OrxDisciplineFamily, Partial<Record<string, number>>>
> = {};

// ── Signal Family Definitions ──

export interface SignalFamilyDef {
  key: string;
  weight: number; // within its layer, sums to 1.0
  description: string;
  /** Max contribution cap (0-1). 1.0 = uncapped. */
  max_contribution_cap?: number;
}

export const ORX_SIGNALS_COUNTRY: SignalFamilyDef[] = [
  { key: 'ai_ecosystem',              weight: 0.25, description: 'AI startup density, VC funding, AI company HQs' },
  { key: 'government_ai_readiness',   weight: 0.20, description: 'National AI strategy, regulation maturity, public AI investment' },
  { key: 'digital_infrastructure',    weight: 0.20, description: 'Internet penetration, 5G, cloud infra, data centers' },
  { key: 'talent_skills_environment', weight: 0.20, description: 'STEM graduates, AI talent concentration, international attraction' },
  { key: 'policy_maturity',           weight: 0.15, description: 'Education modernization, hybrid credential recognition, tech visa policy' },
];

export const ORX_SIGNALS_UNIVERSITY: SignalFamilyDef[] = [
  { key: 'curriculum_update_velocity',   weight: 0.20, description: 'Frequency of program/course updates' },
  { key: 'ai_integration',              weight: 0.20, description: 'AI tools in teaching, AI courses/labs, research output' },
  { key: 'applied_learning',            weight: 0.18, description: 'Industry partnerships, internships, co-ops, capstones' },
  { key: 'flexible_learning',           weight: 0.12, description: 'Online/hybrid options, micro-credentials, modular paths' },
  { key: 'transparency_data_freshness', weight: 0.10, description: 'Data recency, published outcomes, catalog accessibility' },
  { key: 'student_signal',              weight: 0.10, description: 'Verified student satisfaction, employment outcomes', max_contribution_cap: 0.50 },
  { key: 'research_compute',            weight: 0.10, description: 'Research labs, compute resources, AI/ML infra' },
];

export const ORX_SIGNALS_PROGRAM: SignalFamilyDef[] = [
  { key: 'future_skill_alignment',  weight: 0.25, description: 'Alignment with projected labor demand (5-10yr horizon)' },
  { key: 'curriculum_freshness',    weight: 0.20, description: 'Content age, last revision, emerging topic inclusion' },
  { key: 'ai_workflow_exposure',    weight: 0.18, description: 'Hands-on AI tools, AI-augmented assignments, GenAI literacy' },
  { key: 'transferability',         weight: 0.15, description: 'Cross-industry applicability, foundational vs narrow balance' },
  { key: 'applied_industry_signal', weight: 0.12, description: 'Real projects, industry mentors, placement pathways' },
  { key: 'student_value_signal',    weight: 0.10, description: 'Employment rate, salary uplift, time-to-employment', max_contribution_cap: 0.50 },
];

export const ORX_SIGNALS_BY_LAYER: Record<OrxLayer, SignalFamilyDef[]> = {
  country: ORX_SIGNALS_COUNTRY,
  university: ORX_SIGNALS_UNIVERSITY,
  program: ORX_SIGNALS_PROGRAM,
};

// ── Student Signal Cap ──

/**
 * Until a verified student pipeline exists, student-based signals
 * are capped at 50% of their nominal weight contribution.
 * This prevents unverified or low-quality student data from
 * inflating scores.
 */
export const ORX_STUDENT_SIGNAL_CAP = {
  cap_multiplier: 0.50,
  reason: 'No verified student pipeline in v1.x. Cap prevents unverified inflation.',
  affected_signals: ['student_signal', 'student_value_signal'],
  lift_condition: 'Verified enrollment + identity pipeline operational',
} as const;

// ── Evidence Rules ──

export type EvidenceTrustLevel = 'high' | 'medium' | 'low';

export interface EvidenceSourceDef {
  source_type: string;
  trust_level: EvidenceTrustLevel;
  description: string;
  /** If true, this source can only provide supporting context, never primary scoring input. */
  contextual_only?: boolean;
}

export const ORX_VALID_EVIDENCE_SOURCES: EvidenceSourceDef[] = [
  { source_type: 'official_website',    trust_level: 'high',   description: 'University/program pages, course catalogs' },
  { source_type: 'course_catalog',      trust_level: 'high',   description: 'Structured course listings with descriptions' },
  { source_type: 'official_pdf',        trust_level: 'high',   description: 'Handbooks, prospectuses, annual reports' },
  { source_type: 'structured_data',     trust_level: 'high',   description: 'Schema.org markup, API responses' },
  { source_type: 'government_report',   trust_level: 'high',   description: 'National education/AI statistics' },
  { source_type: 'accreditation_body',  trust_level: 'high',   description: 'QAA, ABET, EQUIS, AACSB reports' },
  { source_type: 'verified_student',    trust_level: 'medium', description: 'Authenticated reviews with enrollment proof' },
  { source_type: 'third_party_index',   trust_level: 'medium', description: 'QS, THE, Shanghai (contextual only — never primary score source)', contextual_only: true },
  { source_type: 'news_press',          trust_level: 'low',    description: 'Press releases, news (supporting only)', contextual_only: true },
];

/**
 * THIRD-PARTY INDEX RULE (v1.1):
 * QS, THE, Shanghai, and similar rankings are CONTEXTUAL INPUTS ONLY.
 * They may inform background understanding but:
 * - NEVER serve as primary evidence for any signal family score
 * - NEVER cause direct score inheritance (e.g., "QS rank 50 → ORX score 80")
 * - NEVER substitute for first-party evidence
 * Violation of this rule invalidates the scored status.
 */
export const ORX_THIRD_PARTY_INDEX_RULE = {
  role: 'contextual_only',
  prohibited: [
    'primary_score_source',
    'direct_score_inheritance',
    'substitute_for_first_party_evidence',
  ],
  examples_of_valid_use: [
    'Corroborate research output claims',
    'Cross-check country-level talent density',
    'Validate that university is accredited/recognized',
  ],
} as const;

export const ORX_EXCLUDED_EVIDENCE = [
  'unverified_anonymous_reviews',
  'social_media_unverified',
  'marketing_materials',
  'ai_generated_unverified',
  'paid_advertisements',
  'outdated_36mo_plus',
  'self_reported_uncorroborated',
] as const;

// ── Confidence Logic ──

/**
 * v1.1 adds `source_independence` to prevent confidence inflation
 * from many pages on the same origin/domain.
 */
export const ORX_CONFIDENCE_FACTORS = {
  evidence_count:       0.20,
  evidence_diversity:   0.20,
  source_independence:  0.20,
  evidence_freshness:   0.15,
  signal_completeness:  0.15,
  conflict_rate:        0.10,
} as const;

/**
 * Source independence scoring:
 * - Each unique registrable domain counts as one independent source
 * - Multiple pages on the same domain count as ONE source for independence
 * - Minimum 2 independent sources required for confidence > 50
 * - Minimum 3 independent sources required for confidence > 70
 */
export const ORX_SOURCE_INDEPENDENCE_RULES = {
  unit: 'registrable_domain',
  min_for_confidence_50: 2,
  min_for_confidence_70: 3,
  same_domain_max_contribution: 0.40,
} as const;

export const ORX_CONFIDENCE_THRESHOLDS = {
  strong:       { min: 80, max: 100, label: 'Strong' },
  moderate:     { min: 60, max: 79,  label: 'Moderate' },
  weak:         { min: 40, max: 59,  label: 'Weak' },
  insufficient: { min: 0,  max: 39,  label: 'Insufficient' },
} as const;

// ── Status Thresholds (TIGHTENED v1.1) ──

export const ORX_STATUS_RULES = {
  scored: {
    min_confidence: 40,
    min_signal_families_with_evidence: 3,
    /** v1.1: minimum total evidence items (across all families) */
    min_evidence_count: 5,
    /** v1.1: must include at least one HIGH trust-level source */
    min_high_trust_sources: 1,
    /** v1.1: minimum independent sources (different domains) */
    min_independent_sources: 2,
    /** v1.1: core signal families that MUST have evidence */
    required_core_families: {
      university: ['curriculum_update_velocity', 'ai_integration'],
      program: ['future_skill_alignment', 'curriculum_freshness'],
      country: ['ai_ecosystem'],
    },
    requires_score_computation: true,
  },
  evaluating: {
    description: 'Entity known, evidence collection in progress or confidence < 40 but trending up',
  },
  insufficient: {
    max_signal_families_with_evidence: 2,
    max_confidence: 39,
    requires_full_evaluation_attempt: true,
  },
} as const;

// ── Freshness & Decay ──

export interface DecayBracket {
  max_age_months: number;
  weight_multiplier: number;
}

export const ORX_DECAY_BRACKETS: DecayBracket[] = [
  { max_age_months: 6,  weight_multiplier: 1.0 },
  { max_age_months: 12, weight_multiplier: 0.9 },
  { max_age_months: 18, weight_multiplier: 0.75 },
  { max_age_months: 24, weight_multiplier: 0.6 },
  { max_age_months: 36, weight_multiplier: 0.4 },
  // 36+ months → excluded (multiplier 0)
];

export const ORX_STALENESS_RULES = {
  stale_after_months: 12,
  revert_after_months: 24,
  periodic_refresh_months: 6,
} as const;

// ── Badge Criteria ──

export interface BadgeCriteria {
  badge: string;
  rules: Array<{ signal_or_score: string; layer?: OrxLayer; min_value: number }>;
}

export const ORX_BADGE_CRITERIA: BadgeCriteria[] = [
  {
    badge: 'future_ready',
    rules: [{ signal_or_score: 'overall_score', min_value: 75 }],
  },
  {
    badge: 'high_future_relevance',
    rules: [{ signal_or_score: 'layer_score', layer: 'program', min_value: 80 }],
  },
  {
    badge: 'ai_era_ready',
    rules: [
      { signal_or_score: 'ai_integration', layer: 'university', min_value: 70 },
      { signal_or_score: 'ai_workflow_exposure', layer: 'program', min_value: 70 },
    ],
  },
  {
    badge: 'strong_industry_link',
    rules: [
      { signal_or_score: 'applied_learning', layer: 'university', min_value: 75 },
      { signal_or_score: 'applied_industry_signal', layer: 'program', min_value: 75 },
    ],
  },
  {
    badge: 'fast_adapter',
    rules: [{ signal_or_score: 'curriculum_update_velocity', layer: 'university', min_value: 80 }],
  },
  {
    badge: 'transparent',
    rules: [{ signal_or_score: 'transparency_data_freshness', layer: 'university', min_value: 80 }],
  },
];

// ── Composite Score Formula (pseudo) ──
// final_score = (ORX_C × 0.20) + (ORX_U × 0.35) + (ORX_P × 0.45)
// Each layer score = weighted sum of signal family scores within that layer
// Each signal family score = f(evidence items, decay-adjusted, trust-weighted)
// Student signals capped per ORX_STUDENT_SIGNAL_CAP
// Third-party index sources excluded from primary scoring per ORX_THIRD_PARTY_INDEX_RULE

// ── Re-evaluation Triggers ──

export const ORX_REEVALUATION_TRIGGERS = [
  'new_evidence_arrived',
  'methodology_version_changed',
  'periodic_refresh_due',
  'admin_manual_trigger',
] as const;

export type OrxReevaluationTrigger = typeof ORX_REEVALUATION_TRIGGERS[number];
