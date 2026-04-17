// ═══════════════════════════════════════════════════════════════
// Document AI Resolver
// ═══════════════════════════════════════════════════════════════
// Single entry the engine calls. Tries paddle_self_hosted first,
// falls back EXPLICITLY to browser_heuristic, never silently.
//
// Returns a ResolvedStructured object that always carries:
//   - the StructuredDocumentArtifact actually used
//   - the provider/mode that produced it
//   - the fail-closed reason (if paddle was tried and failed)
// ═══════════════════════════════════════════════════════════════

import type { DocumentAIRequest, DocumentAIMode, DocumentAIStatus } from './document-ai-provider';
import { paddleStructureClient } from './paddle-structure-client';
import { persistDocumentAIRun } from './persist-run';
import { buildStructuredBrowserArtifact } from '../parsers/structured-artifact-builder';
import type { ReadingArtifact } from '../reading-artifact-model';
import type { StructuredDocumentArtifact } from '../structured-browser-artifact-model';

export interface ResolvedStructured {
  artifact: StructuredDocumentArtifact;
  /** What actually produced the artifact in use. */
  mode_used: DocumentAIMode;
  /** Diagnostic: what we tried for paddle. */
  paddle_attempted: boolean;
  paddle_status: DocumentAIStatus | null;
  paddle_reason: string | null;
  paddle_latency_ms: number | null;
  paddle_error_message: string | null;
}

/** Decide whether to even attempt the remote provider.
 *  We attempt for any non-empty file; the edge function itself
 *  short-circuits with 'no_endpoint_configured' when secrets are
 *  missing — that is the primary fail-closed signal. */
function shouldAttemptPaddle(req: DocumentAIRequest): boolean {
  if (!req.storage_path) return false;        // privacy: only via Storage path
  if (!req.mime_type) return false;
  // Skip non-document mimes early.
  if (req.mime_type.startsWith('image/') || req.mime_type === 'application/pdf') return true;
  return false;
}

export async function resolveStructuredArtifact(params: {
  reading_artifact: ReadingArtifact;
  ai_request: DocumentAIRequest;
}): Promise<ResolvedStructured> {
  const { reading_artifact, ai_request } = params;

  // Browser fallback is always available and never throws.
  const browserArtifact = buildStructuredBrowserArtifact(reading_artifact);

  if (!shouldAttemptPaddle(ai_request)) {
    return {
      artifact: browserArtifact,
      mode_used: browserArtifact.builder === 'none' ? 'none' : 'browser_heuristic',
      paddle_attempted: false,
      paddle_status: null,
      paddle_reason: null,
      paddle_latency_ms: null,
      paddle_error_message: null,
    };
  }

  const paddleResp = await paddleStructureClient.getStructuredArtifact(ai_request);

  // Audit every attempt (best-effort).
  void persistDocumentAIRun({
    document_id: ai_request.document_id,
    storage_path: ai_request.storage_path,
    response: paddleResp,
  });

  if (paddleResp.status === 'ok' && paddleResp.artifact) {
    return {
      artifact: paddleResp.artifact,
      mode_used: 'paddle_self_hosted',
      paddle_attempted: true,
      paddle_status: paddleResp.status,
      paddle_reason: paddleResp.reason,
      paddle_latency_ms: paddleResp.latency_ms,
      paddle_error_message: paddleResp.error_message ?? null,
    };
  }

  // FAIL-CLOSED: paddle unavailable / error → explicit browser fallback.
  console.warn('[DocumentAI] paddle_unavailable → browser_heuristic fallback', {
    reason: paddleResp.reason,
    error: paddleResp.error_message,
    latency_ms: paddleResp.latency_ms,
  });
  return {
    artifact: browserArtifact,
    mode_used: browserArtifact.builder === 'none' ? 'none' : 'browser_heuristic',
    paddle_attempted: true,
    paddle_status: paddleResp.status,
    paddle_reason: paddleResp.reason,
    paddle_latency_ms: paddleResp.latency_ms,
    paddle_error_message: paddleResp.error_message ?? null,
  };
}
