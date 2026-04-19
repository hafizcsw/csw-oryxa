// ═══════════════════════════════════════════════════════════════
// Foundation — Review Skeleton (official, V1)
// ═══════════════════════════════════════════════════════════════
// Holds the minimal review surface. No UI. No workflow yet.
// Just the truthful shape downstream code reads from.
// ═══════════════════════════════════════════════════════════════

export type ReviewStatus =
  | 'not_required'
  | 'pending'
  | 'in_review'
  | 'resolved'
  | 'rejected';

export type ReviewReason =
  | 'unknown_family'
  | 'low_route_confidence'
  | 'composite_suspected'
  | 'ambiguous_content'
  | 'privacy_violation_blocked'
  | 'manual_request';

export interface ReviewState {
  document_id: string;
  requires_review: boolean;
  review_reason: ReviewReason[];
  review_status: ReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export function emptyReviewState(documentId: string): ReviewState {
  return {
    document_id: documentId,
    requires_review: false,
    review_reason: [],
    review_status: 'not_required',
    reviewed_by: null,
    reviewed_at: null,
  };
}

export function reviewFromRoute(
  documentId: string,
  requiresReview: boolean,
  reasons: ReviewReason[],
): ReviewState {
  return {
    document_id: documentId,
    requires_review: requiresReview,
    review_reason: requiresReview ? reasons : [],
    review_status: requiresReview ? 'pending' : 'not_required',
    reviewed_by: null,
    reviewed_at: null,
  };
}
