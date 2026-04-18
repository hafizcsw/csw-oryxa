// ═══════════════════════════════════════════════════════════════
// Document AI Resolver — Door 1.5 (single-call discipline)
// ═══════════════════════════════════════════════════════════════
// Single entry the engine calls. Resolves the structured artifact
// without ever calling Paddle twice for the same document.
//
// HARD-CUTOVER RULE:
//   - If Paddle produced the reading artifact, reuse the cached raw
//     Paddle response locally.
//   - If Paddle did not produce a usable artifact, FAIL CLOSED.
//   - No in-browser structured fallback remains active here.
// ═══════════════════════════════════════════════════════════════

import type { DocumentAIRequest, DocumentAIMode, DocumentAIStatus } from './document-ai-provider';
import { readPaddleResponse } from './paddle-response-cache';
import { mapPaddleResponseToArtifact } from './paddle-output-mapper';
import { persistDocumentAIRun } from './persist-run';
import type { ReadingArtifact } from '../reading-artifact-model';
import {
  emptyStructuredArtifact,
  type StructuredDocumentArtifact,
} from '../structured-browser-artifact-model';

export interface ResolvedStructured {
  artifact: StructuredDocumentArtifact;
  /** What actually produced the artifact in use. */
  mode_used: DocumentAIMode;
  /** Diagnostic: was Paddle the source (via cached reading-stage call). */
  paddle_attempted: boolean;
  paddle_status: DocumentAIStatus | null;
  paddle_reason: string | null;
  paddle_latency_ms: number | null;
  paddle_error_message: string | null;
}

export async function resolveStructuredArtifact(params: {
  reading_artifact: ReadingArtifact;
  ai_request: DocumentAIRequest;
}): Promise<ResolvedStructured> {
  const { reading_artifact, ai_request } = params;

  // ── Path 1: reading came from Paddle → reuse cached response ──
  if (reading_artifact.reader_implementation === 'paddle_self_hosted') {
    const cached = readPaddleResponse(ai_request.document_id);
    if (cached) {
      const artifact = mapPaddleResponseToArtifact(cached);
      const resolved: ResolvedStructured = {
        artifact,
        mode_used: 'paddle_self_hosted',
        paddle_attempted: true,
        paddle_status: 'ok',
        paddle_reason: 'reused_from_reader',
        paddle_latency_ms: 0,
        paddle_error_message: null,
      };
      void persistDocumentAIRun({
        document_id: ai_request.document_id,
        storage_path: ai_request.storage_path,
        response: {
          mode: 'paddle_self_hosted',
          status: 'ok',
          reason: 'reused_from_reader',
          latency_ms: 0,
          artifact,
        },
      });
      return resolved;
    }

    return {
      artifact: emptyStructuredArtifact(),
      mode_used: 'none',
      paddle_attempted: true,
      paddle_status: 'error',
      paddle_reason: 'cache_miss',
      paddle_latency_ms: null,
      paddle_error_message: 'paddle_response_cache_missing',
    };
  }

  return {
    artifact: emptyStructuredArtifact(),
    mode_used: 'none',
    paddle_attempted: reading_artifact.reader_implementation === 'paddle_self_hosted',
    paddle_status: null,
    paddle_reason: reading_artifact.failure_reason ?? 'reader_not_paddle',
    paddle_latency_ms: null,
    paddle_error_message: reading_artifact.failure_detail ?? null,
  };
}
