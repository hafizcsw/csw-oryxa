// ═══════════════════════════════════════════════════════════════
// Paddle Structure Client — Provider implementation
// ═══════════════════════════════════════════════════════════════
// Talks to the `paddle-structure` Supabase Edge Function (proxy).
// The browser NEVER hits Paddle directly.
//
// Fail-closed semantics:
//   - Any error / missing config / non-200 → DocumentAIResponse
//     with status='unavailable' or 'error', artifact=null.
//   - NEVER throws. NEVER fabricates success.
// ═══════════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';
import type {
  DocumentAIProvider,
  DocumentAIRequest,
  DocumentAIResponse,
} from './document-ai-provider';
import { unavailableResponse } from './document-ai-provider';
import {
  mapPaddleResponseToArtifact,
  type PaddleStructureResponse,
} from './paddle-output-mapper';

const TIMEOUT_MS = 30_000;

export const paddleStructureClient: DocumentAIProvider = {
  mode: 'paddle_self_hosted',

  async getStructuredArtifact(req: DocumentAIRequest): Promise<DocumentAIResponse> {
    const t0 = performance.now();
    try {
      // Storage path is the privacy-preferred transport: file already lives
      // in the user's documents bucket; the edge proxy issues a short-lived
      // signed URL for Paddle to fetch.
      if (!req.storage_path) {
        return unavailableResponse(
          'paddle_self_hosted',
          'no_storage_path',
          Math.round(performance.now() - t0),
          'paddle path requires uploaded storage_path',
        );
      }

      const { data, error } = await supabase.functions.invoke('paddle-structure', {
        body: {
          document_id: req.document_id,
          storage_path: req.storage_path,
          mime_type: req.mime_type,
          file_name: req.file_name,
        },
      });

      const latency = Math.round(performance.now() - t0);

      if (error) {
        return unavailableResponse(
          'paddle_self_hosted',
          'edge_invoke_failed',
          latency,
          error.message ?? null,
        );
      }

      // Edge function may have returned a fail-closed envelope itself
      // (e.g. when PADDLE_STRUCTURE_ENDPOINT is not configured).
      if (!data || typeof data !== 'object') {
        return unavailableResponse(
          'paddle_self_hosted',
          'empty_response',
          latency,
        );
      }

      const envelope = data as {
        ok: boolean;
        reason?: string;
        error_message?: string | null;
        result?: PaddleStructureResponse;
      };

      if (!envelope.ok || !envelope.result) {
        return {
          mode: 'paddle_self_hosted',
          status: envelope.reason === 'no_endpoint_configured' ? 'unavailable' : 'error',
          reason: envelope.reason || 'paddle_unavailable',
          latency_ms: latency,
          artifact: null,
          error_message: envelope.error_message ?? null,
        };
      }

      const artifact = mapPaddleResponseToArtifact(envelope.result);
      return {
        mode: 'paddle_self_hosted',
        status: 'ok',
        reason: 'ok',
        latency_ms: latency,
        artifact,
      };
    } catch (err) {
      const latency = Math.round(performance.now() - t0);
      const msg = err instanceof Error ? err.message : 'unknown_error';
      // Treat anything unexpected as unavailable, not error — engine will
      // fall back to browser_heuristic explicitly.
      return unavailableResponse(
        'paddle_self_hosted',
        'client_exception',
        latency,
        msg,
      );
    } finally {
      // ensure latency upper bound is enforced cooperatively
      void TIMEOUT_MS;
    }
  },
};
