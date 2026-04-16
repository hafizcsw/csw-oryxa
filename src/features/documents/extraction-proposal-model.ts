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

/** Context required to apply promotion rules honestly. */
export interface PromotionContext {
  /** Reading-stage readability of the source artifact. */
  readability?: 'readable' | 'degraded' | 'unreadable';
  /**
   * Which parser produced the value of THIS proposal.
   * Used by the passport lane gate: identity.* fields can only auto-accept
   * when sourced from MRZ. Anything else (regex_heuristic on raw text,
   * filename-only, etc.) is treated as weak evidence.
   */
  parser_source?: 'mrz' | 'pdf_text' | 'image_ocr' | 'regex_heuristic' | 'filename_only' | 'none';
  /**
   * Passport lane strength as decided by the classifier
   * (see PassportLaneStrength). Pass through here so the promotion
   * layer can refuse auto-accept on weak passport classifications even
   * for identity.* fields with high textual confidence.
   */
  lane_strength?: 'passport_strong' | 'passport_weak' | null;
  /**
   * Order-2: indicates this proposal originated from the transcript lane.
   * Used by HONESTY GATE 3 to force pending_review on every transcript
   * field in V1 — no auto-accept on transcripts, ever.
   */
  source_lane?: 'passport' | 'transcript' | 'graduation' | 'language' | 'unknown';
}

/** Identity fields that are part of the passport lane. */
const PASSPORT_IDENTITY_FIELDS = new Set<string>([
  'identity.passport_name',
  'identity.passport_number',
  'identity.date_of_birth',
  'identity.gender',
  'identity.citizenship',
  'identity.passport_issue_date',
  'identity.passport_expiry_date',
  'identity.passport_issuing_country',
]);

/**
 * Apply truth promotion rules to a proposal.
 *
 * HONESTY GATES:
 *   1. Degraded artifact  → never auto_accepted (engine-layer guard).
 *   2. Passport lane gate → identity.* fields can only auto-accept when:
 *        - parser_source === 'mrz'  (MRZ is the only strong evidence
 *          source for passport identity), AND
 *        - lane_strength !== 'passport_weak' (classifier saw strong
 *          passport evidence in the text, not just filename/slot hint).
 *      Identity fields produced by regex_heuristic on raw text are
 *      ALWAYS routed to pending_review, even at high confidence and
 *      even for low-risk fields.
 */
export function applyPromotionRules(
  proposal: ExtractionProposal,
  context: PromotionContext = {},
): ExtractionProposal {
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

  // HONESTY GATE 1: degraded artifacts cannot produce auto_accepted proposals.
  if (context.readability === 'degraded') {
    updated.proposal_status = 'pending_review';
    updated.requires_review = true;
    updated.auto_apply_candidate = false;
    return updated;
  }

  // HONESTY GATE 2: passport lane discipline.
  // For any identity.* field belonging to the passport lane:
  //   - Source must be MRZ; weak text-heuristic fallback can never auto-accept.
  //   - Classification must be passport_strong; passport_weak can never auto-accept.
  if (PASSPORT_IDENTITY_FIELDS.has(updated.field_key)) {
    const fromMrz = context.parser_source === 'mrz';
    const strong = context.lane_strength !== 'passport_weak';
    if (!fromMrz || !strong) {
      updated.proposal_status = 'pending_review';
      updated.requires_review = true;
      updated.auto_apply_candidate = false;
      return updated;
    }
  }

  // HONESTY GATE 3: transcript lane is review-first only in V1.
  // No transcript-derived field can ever auto-accept — even high-confidence
  // header fields like institution_name. Transcripts are partial/structured
  // and require human review before entering canonical truth.
  if (context.source_lane === 'transcript') {
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
