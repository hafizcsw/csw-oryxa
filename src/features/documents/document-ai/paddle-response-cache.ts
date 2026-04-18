// ═══════════════════════════════════════════════════════════════
// Paddle Response Cache — single-call guarantee
// ═══════════════════════════════════════════════════════════════
// PaddleReader (primary reader, Door 1) caches the raw
// PaddleStructureResponse here keyed by document_id. The
// resolveStructuredArtifact() resolver consults this cache BEFORE
// invoking the Paddle edge function again — eliminating the
// double-call that would otherwise occur in the soft-cutover
// pipeline (one call from PaddleReader, one from resolver).
//
// Lifetime: in-memory, cleared as the page session ends. Per
// document_id slot, last writer wins. No persistence by design.
// ═══════════════════════════════════════════════════════════════

import type { PaddleStructureResponse } from './paddle-output-mapper';

interface Entry {
  response: PaddleStructureResponse;
  at: number;
}

const cache = new Map<string, Entry>();

/** Store the raw Paddle response captured by PaddleReader. */
export function storePaddleResponse(documentId: string, response: PaddleStructureResponse): void {
  if (!documentId) return;
  cache.set(documentId, { response, at: Date.now() });
}

/** Retrieve a previously captured Paddle response, if any. */
export function readPaddleResponse(documentId: string | null | undefined): PaddleStructureResponse | null {
  if (!documentId) return null;
  return cache.get(documentId)?.response ?? null;
}

/** Drop a single entry. */
export function clearPaddleResponse(documentId: string): void {
  cache.delete(documentId);
}
