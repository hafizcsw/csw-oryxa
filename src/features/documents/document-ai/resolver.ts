// ═══════════════════════════════════════════════════════════════
// Document AI Resolver — Door 1.5 (single-call discipline)
// ═══════════════════════════════════════════════════════════════
// Single entry the engine calls. Resolves the structured artifact
// without ever calling Paddle twice for the same document:
//
//   1. If PaddleReader already produced this artifact (the soft-
//      cutover primary path), we look up the cached raw Paddle
//      response and map it locally to a StructuredDocumentArtifact.
//      ZERO additional network round-trips.
//
//   2. If the reading_artifact came from legacy_browser_fallback /
//      legacy_browser (Paddle never ran or failed at the reading
//      stage), we DO NOT retry Paddle. The reading-stage decision
//      is authoritative — re-attempting here would contradict it
//      and cost a second round-trip. We build the structured
//      artifact in-browser.
//
//   3. If reading was skipped entirely (e.g. unsupported MIME),
//      we fall back to the browser builder and tag mode='none'.
//
// Diagnostic surface (paddle_attempted etc.) reflects what the
// READING stage tried, not a separate attempt here.
// ═══════════════════════════════════════════════════════════════

import type { DocumentAIRequest, DocumentAIMode, DocumentAIStatus } from './document-ai-provider';
import { readPaddleResponse } from './paddle-response-cache';
import { mapPaddleResponseToArtifact } from './paddle-output-mapper';
import { persistDocumentAIRun } from './persist-run';
import { buildStructuredBrowserArtifact } from '../parsers/structured-artifact-builder';
import type { ReadingArtifact } from '../reading-artifact-model';
import type { StructuredDocumentArtifact } from '../structured-browser-artifact-model';

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
    // Cache miss is unexpected (reader said paddle ran). Fall through
    // to browser fallback and tag honestly.
    const browserArtifact = buildStructuredBrowserArtifact(reading_artifact);
    return {
      artifact: browserArtifact,
      mode_used: browserArtifact.builder === 'none' ? 'none' : 'browser_heuristic',
      paddle_attempted: true,
      paddle_status: 'error',
      paddle_reason: 'cache_miss',
      paddle_latency_ms: null,
      paddle_error_message: 'paddle_response_cache_missing',
    };
  }

  // ── Path 2: reading came from legacy_*  → DO NOT re-call Paddle ──
  // The reader-stage router already made an authoritative decision
  // about Paddle availability (success / failure / unavailable).
  // Re-trying here would create the very double-call we're closing.
  const browserArtifact = buildStructuredBrowserArtifact(reading_artifact);
  const isLegacyFallback = reading_artifact.reader_implementation === 'legacy_browser_fallback';
  return {
    artifact: browserArtifact,
    mode_used: browserArtifact.builder === 'none' ? 'none' : 'browser_heuristic',
    paddle_attempted: isLegacyFallback,
    paddle_status: isLegacyFallback ? 'error' : null,
    paddle_reason: isLegacyFallback
      ? (reading_artifact.failure_reason ?? 'paddle_failed_at_reader')
      : null,
    paddle_latency_ms: null,
    paddle_error_message: isLegacyFallback
      ? (reading_artifact.failure_detail ?? null)
      : null,
  };
}
