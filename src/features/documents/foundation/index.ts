// ═══════════════════════════════════════════════════════════════
// Foundation — Public API
// ═══════════════════════════════════════════════════════════════
// The ONLY surface code outside foundation/ may import.
// Produces a FoundationOutput for any uploaded file.
// No extraction. No external IO. No hidden fallback.
// ═══════════════════════════════════════════════════════════════

import { classifyAndRoute } from './classifier';
import { type RouteDecision } from './route-decision';
import {
  emptyNormalizedDocument,
  type NormalizedDocument,
} from './normalized-document';
import {
  emptyReviewState,
  reviewFromRoute,
  type ReviewState,
  type ReviewReason,
} from './review-skeleton';
import {
  type ProcessingState,
  assertProcessingState,
} from './truth-model';
import { withPrivacyGuard } from './privacy-guard';

export interface FoundationInput {
  document_id: string;
  file: File;
}

export interface FoundationOutput {
  document_id: string;
  route: RouteDecision;
  normalized: NormalizedDocument;
  review: ReviewState;
  processing_state: ProcessingState;
  /** True if a privacy violation was caught and the run was downgraded. */
  privacy_blocked: boolean;
}

export async function runFoundation(input: FoundationInput): Promise<FoundationOutput> {
  const { document_id, file } = input;

  const guarded = await withPrivacyGuard('foundation.classifyAndRoute', () =>
    classifyAndRoute({ document_id, file }),
  );

  if (!guarded.ok) {
    const route = {
      document_id,
      route_family: 'unknown_document' as const,
      route_confidence: 0,
      route_reasons: ['privacy_violation_blocked', guarded.reason],
      selected_lane: 'review_lane' as const,
      is_async: false,
      requires_review: true,
      decided_at: new Date().toISOString(),
      router_version: 'foundation-v1',
    };
    const review: ReviewState = reviewFromRoute(document_id, true, [
      'privacy_violation_blocked',
    ]);
    const normalized = emptyNormalizedDocument(document_id);
    normalized.warnings.push('privacy_violation_blocked');
    return {
      document_id,
      route,
      normalized,
      review,
      processing_state: assertProcessingState('needs_review'),
      privacy_blocked: true,
    };
  }

  const route = guarded.value;

  // Foundation gate: NO extraction. Always emit an empty normalized doc
  // with truthful provenance. Lanes will fill it later.
  const normalized = emptyNormalizedDocument(document_id);
  normalized.warnings.push(`route_family=${route.route_family}`);
  normalized.warnings.push(`route_confidence=${route.route_confidence}`);
  normalized.provenance.notes.push('foundation gate — no extraction performed');

  const reasons: ReviewReason[] = [];
  if (route.route_family === 'unknown_document') reasons.push('unknown_family');
  if (route.route_confidence < 0.7) reasons.push('low_route_confidence');

  const review = route.requires_review
    ? reviewFromRoute(document_id, true, reasons.length ? reasons : ['ambiguous_content'])
    : emptyReviewState(document_id);

  const processing_state: ProcessingState = route.requires_review
    ? assertProcessingState('needs_review')
    : assertProcessingState('queued');

  return {
    document_id,
    route,
    normalized,
    review,
    processing_state,
    privacy_blocked: false,
  };
}

// Re-exports — single import surface
export type { RouteDecision } from './route-decision';
export type { NormalizedDocument } from './normalized-document';
export type { ReviewState, ReviewReason, ReviewStatus } from './review-skeleton';
export type {
  TruthState,
  ProcessingState,
} from './truth-model';
export type { DocumentFamily, ProcessingLane } from './families';
export { ALL_FAMILIES, isKnownFamily, defaultLaneFor } from './families';
export {
  ALL_TRUTH_STATES,
  ALL_PROCESSING_STATES,
  assertTruthState,
  assertProcessingState,
} from './truth-model';
export { assertNoExternalRawPath, PrivacyViolationError } from './privacy-guard';
