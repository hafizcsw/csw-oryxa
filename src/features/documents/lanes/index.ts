// ═══════════════════════════════════════════════════════════════
// ⛔ DEPRECATED — DEAD PATH (Phase A truth-table)
// ═══════════════════════════════════════════════════════════════
// This client-side lane dispatcher (Door 2 era) is no longer the live
// path. The live path runs server-side in:
//   student-portal-api (identity_upload_sign_url)
//      → mistral-document-pipeline
//      → document_lane_facts / document_review_queue
//
// `dispatchLane`, `runPassportLane`, `runSimpleCertificateLane`, and
// `persistLaneFacts` MUST NOT be called from any new code. The exported
// types (LaneFactsOutput, CanonicalField, LaneKind, FieldStatus) are
// still consumed by `useDocumentLaneFacts` / `LaneFactsCard` and remain
// valid — they describe the row shape, not a live execution path.
// See: docs/document-pipeline-truth-table.md
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
