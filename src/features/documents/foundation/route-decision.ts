// ═══════════════════════════════════════════════════════════════
// Foundation — Route Decision Contract (official, V1)
// ═══════════════════════════════════════════════════════════════
// Single contract every uploaded file MUST receive at the moment
// of registration. Built BEFORE any heavy parsing.
// Lanes consume this; they do not invent it.
// ═══════════════════════════════════════════════════════════════

import type { DocumentFamily, ProcessingLane } from './families';

export interface RouteDecision {
  /** References the document_id in the document registry. */
  document_id: string;
  /** Family the router believes this file belongs to. */
  route_family: DocumentFamily;
  /** 0.0–1.0 — confidence the family is correct. */
  route_confidence: number;
  /** Plain-text reasons that produced this decision (for audit). */
  route_reasons: string[];
  /** Which downstream lane this file is assigned to. */
  selected_lane: ProcessingLane;
  /** Whether the lane is async (heavy work) or sync (cheap). */
  is_async: boolean;
  /** True when the file MUST go through human review before truth. */
  requires_review: boolean;
  /** When the routing decision was made. */
  decided_at: string;
  /** Identifier of the routing logic version (for audit). */
  router_version: string;
}

export const ROUTER_VERSION = 'foundation-v1';

/** The conservative fallback decision for anything we cannot identify. */
export function unknownDecision(documentId: string, reasons: string[]): RouteDecision {
  return {
    document_id: documentId,
    route_family: 'unknown_document',
    route_confidence: 0,
    route_reasons: reasons.length ? reasons : ['no_signal'],
    selected_lane: 'review_lane',
    is_async: false,
    requires_review: true,
    decided_at: new Date().toISOString(),
    router_version: ROUTER_VERSION,
  };
}
