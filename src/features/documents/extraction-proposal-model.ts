// ═══════════════════════════════════════════════════════════════
// Extraction Proposal Model — Door 3: Proposal layer
// ═══════════════════════════════════════════════════════════════
// Every extracted value becomes a proposal, never direct truth.
// Proposals must be accepted (auto or manual) before entering
// canonical student file.
// ═══════════════════════════════════════════════════════════════

// ── Proposal status lifecycle ────────────────────────────────
export type ProposalStatus =
  | 'proposed'          // just extracted, not yet acted on
  | 'auto_accepted'     // auto-accepted by truth promotion rules
  | 'pending_review'    // needs human review
  | 'rejected'          // explicitly rejected
  | 'superseded';       // replaced by a newer proposal for same field

// ── The Extraction Proposal ──────────────────────────────────
export interface ExtractionProposal {
  proposal_id: string;
  student_id: string;
  document_id: string;
  /** Canonical field path e.g. "identity.passport_name" */
  field_key: string;
  /** Proposed value as string (numbers serialized) */
  proposed_value: string | null;
  /** Normalized value for comparison */
  normalized_value: string | null;
  /** Confidence 0.0–1.0 from extraction */
  confidence: number;
  /** Current lifecycle status */
  proposal_status: ProposalStatus;
  /** True if proposed value conflicts with current canonical value */
  conflict_with_current: boolean;
  /** True if this proposal needs human review */
  requires_review: boolean;
  /** True if this proposal qualifies for auto-accept */
  auto_apply_candidate: boolean;
  /** Timestamps */
  created_at: string;
  updated_at: string;
}

// ── Factory ──────────────────────────────────────────────────

export function createProposal(params: {
  studentId: string;
  documentId: string;
  fieldKey: string;
  proposedValue: string | null;
  normalizedValue: string | null;
  confidence: number;
  conflictWithCurrent: boolean;
}): ExtractionProposal {
  const now = new Date().toISOString();
  return {
    proposal_id: crypto.randomUUID(),
    student_id: params.studentId,
    document_id: params.documentId,
    field_key: params.fieldKey,
    proposed_value: params.proposedValue,
    normalized_value: params.normalizedValue,
    confidence: params.confidence,
    proposal_status: 'proposed',
    conflict_with_current: params.conflictWithCurrent,
    requires_review: false,
    auto_apply_candidate: false,
    created_at: now,
    updated_at: now,
  };
}

// ── Truth Promotion Rules (V1) ───────────────────────────────
// These rules are intentionally conservative for Door 3.

/** Fields that are safe for auto-accept at high confidence */
const LOW_RISK_FIELDS = new Set([
  'identity.passport_name',
  'identity.passport_number',
  'identity.date_of_birth',
  'identity.gender',
  'identity.citizenship',
  'identity.passport_issue_date',
  'identity.passport_expiry_date',
  'identity.passport_issuing_country',
  'academic.credential_name',
  'academic.awarding_institution',
  'academic.institution_name',
  'academic.graduation_year',
  'academic.country_of_education',
  'language.english_test_type',
  'language.english_total_score',
  'language.english_test_date',
  'language.english_expiry_date',
]);

/** Minimum confidence for auto-accept */
const AUTO_ACCEPT_THRESHOLD = 0.85;

/** Apply truth promotion rules to a proposal */
export function applyPromotionRules(proposal: ExtractionProposal): ExtractionProposal {
  const updated = { ...proposal, updated_at: new Date().toISOString() };

  // Rule: reject if value is null/empty
  if (!updated.proposed_value || updated.proposed_value.trim() === '') {
    updated.proposal_status = 'rejected';
    updated.requires_review = false;
    updated.auto_apply_candidate = false;
    return updated;
  }

  // Rule: if conflict exists → always pending_review
  if (updated.conflict_with_current) {
    updated.proposal_status = 'pending_review';
    updated.requires_review = true;
    updated.auto_apply_candidate = false;
    return updated;
  }

  // Rule: auto-accept if low-risk + high confidence + no conflict
  if (
    LOW_RISK_FIELDS.has(updated.field_key) &&
    updated.confidence >= AUTO_ACCEPT_THRESHOLD &&
    !updated.conflict_with_current
  ) {
    updated.proposal_status = 'auto_accepted';
    updated.requires_review = false;
    updated.auto_apply_candidate = true;
    return updated;
  }

  // Rule: pending review for everything else
  updated.proposal_status = 'pending_review';
  updated.requires_review = true;
  updated.auto_apply_candidate = false;
  return updated;
}
