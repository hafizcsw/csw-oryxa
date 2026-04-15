// ═══════════════════════════════════════════════════════════════
// Decision Engine Types — Door 5
// ═══════════════════════════════════════════════════════════════
// Structured output contract for the decision engine.
// Separates: completeness / eligibility / fit / competitiveness.
// No prose. No marketing. No LLM.
// ═══════════════════════════════════════════════════════════════

// ── Domain Buckets V1 ────────────────────────────────────────

export const DOMAIN_BUCKETS = [
  'medicine',
  'engineering',
  'computer_science',
  'business',
  'general_science',
] as const;

export type DomainBucket = typeof DOMAIN_BUCKETS[number];

// ── Status enums ─────────────────────────────────────────────

export type CompletenessStatus = 'complete' | 'partial' | 'insufficient';
export type EligibilityStatus = 'eligible' | 'conditionally_eligible' | 'not_eligible' | 'unknown';
export type FitStatus = 'strong_fit' | 'moderate_fit' | 'weak_fit' | 'no_fit' | 'unknown';
export type CompetitivenessStatus = 'strong' | 'moderate' | 'weak' | 'unknown';

// ── Reason items ─────────────────────────────────────────────

export interface DecisionReason {
  code: string;          // machine-readable key
  label_key: string;     // i18n key
  detail?: string;       // optional structured detail
}

// ── Matched/Missing Subject ──────────────────────────────────

export interface MatchedSubject {
  family: string;
  student_grade_normalized: number | null;
  required_grade_normalized: number | null;
  meets_requirement: boolean;
}

// ── Language Gap ─────────────────────────────────────────────

export interface LanguageGap {
  test_type: string;
  student_score: number | null;
  required_score: number;
  component?: string;    // overall | reading | writing | etc
}

// ── Credential Gap ───────────────────────────────────────────

export interface CredentialGap {
  student_credential: string | null;
  accepted_credentials: string[];
}

// ── Blocker ──────────────────────────────────────────────────

export interface Blocker {
  blocker_id: string;
  category: 'academic' | 'language' | 'credential' | 'document' | 'completeness';
  label_key: string;
  severity: 'blocking' | 'warning';
  detail?: string;
}

// ── Domain Decision ──────────────────────────────────────────

export interface DomainDecision {
  domain: DomainBucket;
  status: 'candidate' | 'rejected' | 'maybe';
  reasons: DecisionReason[];
}

// ═══════════════════════════════════════════════════════════════
// THE DECISION RESULT — Output of Door 5
// ═══════════════════════════════════════════════════════════════

export interface DecisionResult {
  // ── A) Completeness ────────────────────────────────────────
  completeness_status: CompletenessStatus;
  completeness_score: number;         // 0–100
  missing_required_items: DecisionReason[];

  // ── B) Eligibility ─────────────────────────────────────────
  eligibility_status: EligibilityStatus;
  eligibility_reasons: DecisionReason[];

  // ── C) Fit ─────────────────────────────────────────────────
  fit_status: FitStatus;
  fit_reasons: DecisionReason[];

  // ── D) Competitiveness ─────────────────────────────────────
  competitiveness_status: CompetitivenessStatus;
  competitiveness_reasons: DecisionReason[];

  // ── Subject Analysis ───────────────────────────────────────
  matched_subjects: MatchedSubject[];
  missing_subjects: DecisionReason[];

  // ── Gap Details ────────────────────────────────────────────
  language_gaps: LanguageGap[];
  credential_gaps: CredentialGap[];
  blockers: Blocker[];

  // ── Domain Decisions ───────────────────────────────────────
  candidate_domains: DomainDecision[];
  rejected_domains: DomainDecision[];
  maybe_domains: DomainDecision[];

  // ── Counts (from data lane if available) ───────────────────
  candidate_country_count: number | null;
  candidate_university_count: number | null;
  candidate_program_count: number | null;

  // ── Metadata ───────────────────────────────────────────────
  data_lane_available: boolean;
  computed_at: string;
}
