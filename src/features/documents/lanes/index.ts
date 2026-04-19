// ═══════════════════════════════════════════════════════════════
// Door 2 — Lanes Public API + Dispatcher
// ═══════════════════════════════════════════════════════════════
// The ONLY surface uploadAndRegister is allowed to import.
// Decides which lane to run based on the foundation route.
// Lanes for academic_transcript / composite_document / unknown
// are NOT implemented in Door 2 — they remain in needs_review.
// ═══════════════════════════════════════════════════════════════

import { runPassportLane } from './passport-lane';
import { runSimpleCertificateLane } from './simple-certificate-lane';
import type { FoundationOutput } from '../foundation';
import type { LaneFactsOutput } from './lane-fact-model';

export type LaneDispatchResult =
  | { ran: true; output: LaneFactsOutput }
  | { ran: false; reason: string };

export async function dispatchLane(params: {
  foundation: FoundationOutput;
  file: File;
}): Promise<LaneDispatchResult> {
  const { foundation, file } = params;

  if (foundation.privacy_blocked) {
    return { ran: false, reason: 'privacy_blocked' };
  }

  const family = foundation.route.route_family;

  if (family === 'passport_id') {
    const output = await runPassportLane({
      document_id: foundation.document_id,
      file,
    });
    return { ran: true, output };
  }

  if (family === 'graduation_certificate' || family === 'language_certificate') {
    const output = await runSimpleCertificateLane({
      document_id: foundation.document_id,
      file,
      family,
    });
    return { ran: true, output };
  }

  return { ran: false, reason: `no_lane_for_family=${family}` };
}

export type { LaneFactsOutput, CanonicalField, LaneKind, FieldStatus } from './lane-fact-model';
export { aggregateLaneTruth, missingField } from './lane-fact-model';
export { runPassportLane } from './passport-lane';
export { runSimpleCertificateLane } from './simple-certificate-lane';
export { persistLaneFacts } from './persistence';
