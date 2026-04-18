// ═══════════════════════════════════════════════════════════════
// Document AI Provider — Boundary contract
// ═══════════════════════════════════════════════════════════════
// Defines the abstract surface for any self-hosted / external
// document understanding service. The engine consumes this
// boundary, NOT vendor-specific clients.
//
// HARD CONTRACT (post-cutover):
//   - Provider NEVER writes canonical truth.
//   - Provider output is mapped into the existing
//     StructuredDocumentArtifact (no parallel model).
//   - Fail-closed: if unavailable, returns mode='none' with a reason.
//     NEVER throws. NEVER fakes success.
//   - There is NO browser_heuristic fallback in the live engine.
//     The 'browser_heuristic' enum value is preserved ONLY to read
//     historical artifacts produced before the cutover.
// ═══════════════════════════════════════════════════════════════

import type { StructuredDocumentArtifact } from '../structured-browser-artifact-model';

export type DocumentAIMode =
  | 'browser_heuristic'    // HISTORICAL ONLY — pre-cutover artifacts
  | 'paddle_self_hosted'   // self-hosted PaddleOCR PP-StructureV3
  | 'none';                // no provider available / disabled

export type DocumentAIStatus =
  | 'ok'
  | 'unavailable'   // endpoint missing / DNS / network / 5xx
  | 'error'         // provider returned an error response
  | 'skipped';      // intentionally not called (e.g. unsupported mime)

export interface DocumentAIRequest {
  /** Document registry id (UUID/string) — for audit linkage. */
  document_id: string;
  /** Storage path in `documents` bucket if already uploaded; null otherwise. */
  storage_path: string | null;
  /** The raw file (used only if storage_path is null AND provider supports inline). */
  file?: File;
  /** Mime hint for early skip decisions. */
  mime_type: string;
  /** Filename hint (no PII guarantees beyond what user provided). */
  file_name: string;
}

export interface DocumentAIResponse {
  mode: DocumentAIMode;
  status: DocumentAIStatus;
  /** Stable machine reason for status (e.g. 'paddle_unavailable',
   *  'no_endpoint_configured', 'auth_failed', 'unsupported_mime',
   *  'service_5xx', 'timeout'). Always present. */
  reason: string;
  /** Round-trip latency in ms (always present, even on failure). */
  latency_ms: number;
  /** Mapped structured artifact when status === 'ok'. Null otherwise. */
  artifact: StructuredDocumentArtifact | null;
  /** Optional human-readable error detail (safe for logs, never PII). */
  error_message?: string | null;
}

/** Document AI provider strategy. */
export interface DocumentAIProvider {
  readonly mode: DocumentAIMode;
  /** Run the structuring stage. MUST never throw. MUST return a response. */
  getStructuredArtifact(req: DocumentAIRequest): Promise<DocumentAIResponse>;
}

/** Build a uniform "unavailable" response — the fail-closed default. */
export function unavailableResponse(
  mode: DocumentAIMode,
  reason: string,
  latency_ms = 0,
  error_message: string | null = null,
): DocumentAIResponse {
  return {
    mode,
    status: 'unavailable',
    reason,
    latency_ms,
    artifact: null,
    error_message,
  };
}
