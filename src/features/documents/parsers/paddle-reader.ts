// ═══════════════════════════════════════════════════════════════
// Paddle Reader — Door 1: PRIMARY reader implementation
// ═══════════════════════════════════════════════════════════════
// Implements the DocumentReader contract using the self-hosted
// PaddleOCR PP-StructureV3 service via the CRM-aware proxy
// `student-portal-api → crm_storage → paddle_structure_proxy`.
//
// Why the proxy (not the direct `paddle-structure` edge):
// student documents are uploaded through the CRM project (separate
// Supabase) under `<customer_id>/<file_kind>/...`. Only the portal
// proxy can resolve CRM ownership and sign URLs against CRM storage.
// Calling the app-local edge directly produced storage_path_forbidden
// because the file does not live in app storage.
//
// Returns a full ReadingArtifact (full_text, pages, readability,
// failure_reason). Failure_detail is namespaced by stage so audit
// can distinguish provider/network from reading failures:
//   - paddle_provider:<reason>   (Paddle returned non-2xx / bad JSON)
//   - paddle_network:<reason>    (timeout / fetch error)
//   - paddle_ownership:<reason>  (CRM ownership / signing rejected)
//   - paddle_reading:<reason>    (Paddle OK but text unusable)
// ═══════════════════════════════════════════════════════════════

import { callPaddleStructureProxy } from '@/api/crmStorage';
import type { DocumentReader } from '../document-reader-contract';
import {
  type ReadingArtifact,
  type PageReading,
  type TextBlock,
  type ReadingFailureReason,
  createEmptyArtifact,
  resolveReadingRoute,
  assembleFullText,
  assessOcrQuality,
} from '../reading-artifact-model';
import type { PaddleStructureResponse, PaddlePage } from '../document-ai/paddle-output-mapper';
import { storePaddleResponse } from '../document-ai/paddle-response-cache';

/** Storage path is REQUIRED — Paddle reads via signed URL only. */
export interface PaddleReadInput {
  file: File;
  storage_path: string;
  document_id: string;
  /** Optional: when known, lets the proxy verify ownership via the
   *  customer_files row directly (preferred over prefix match). */
  file_id?: string;
  storage_bucket?: string;
}

function pageText(p: PaddlePage): string {
  if (typeof p.text === 'string' && p.text.trim().length > 0) return p.text;
  const blocks = p.blocks ?? [];
  return blocks.map(b => (b.text ?? '').trim()).filter(Boolean).join('\n');
}

function pageBlocks(p: PaddlePage): TextBlock[] {
  const blocks = p.blocks ?? [];
  return blocks
    .map<TextBlock | null>(b => {
      const text = (b.text ?? '').trim();
      if (!text) return null;
      const role = (b.role ?? '').toLowerCase();
      const type: TextBlock['type'] =
        role.includes('table') ? 'table_row'
        : role === 'paragraph' || role === 'text' ? 'paragraph'
        : 'line';
      return { page: p.page_number, text, type };
    })
    .filter((b): b is TextBlock => b !== null);
}

function buildArtifactFromPaddle(
  resp: PaddleStructureResponse,
  file: File,
  startedAt: number,
): ReadingArtifact {
  const route = resolveReadingRoute(file.type);
  const empty = createEmptyArtifact(file.name, file.type, route);

  const pagesIn = Array.isArray(resp.pages) ? resp.pages : [];
  const pages: PageReading[] = pagesIn
    .slice()
    .sort((a, b) => (a.page_number ?? 0) - (b.page_number ?? 0))
    .map(p => {
      const text = pageText(p);
      const blocks = pageBlocks(p);
      return {
        page_number: p.page_number,
        text,
        blocks,
        char_count: text.length,
        has_content: text.trim().length > 0,
      };
    });

  const full_text = assembleFullText(pages);
  const ocr_quality = assessOcrQuality(full_text);

  let readability: ReadingArtifact['readability'];
  let failure_reason: ReadingFailureReason = null;
  let failure_detail: string | null = null;

  if (pages.length === 0 || full_text.trim().length === 0) {
    readability = 'unreadable';
    failure_reason = 'unreadable_scan';
    failure_detail = 'paddle_reading:empty_text';
  } else if (ocr_quality.quality_label === 'garbage') {
    readability = 'unreadable';
    failure_reason = 'low_ocr_quality';
    failure_detail = `paddle_reading:low_quality coherence=${ocr_quality.word_coherence.toFixed(2)} char_q=${ocr_quality.char_quality.toFixed(2)}`;
  } else if (ocr_quality.quality_label === 'partial') {
    readability = 'degraded';
  } else {
    readability = 'readable';
  }

  return {
    ...empty,
    chosen_route: route === 'born_digital_pdf' && pages.length > 0 ? 'born_digital_pdf' : route,
    parser_used: 'paddle_pp_structure_v3',
    reader_implementation: 'paddle_self_hosted',
    pages,
    total_page_count: pages.length,
    pages_processed: pages.length,
    full_text,
    confidence: pages.length > 0 ? pages.filter(p => p.has_content).length / pages.length : 0,
    readability,
    is_readable: readability === 'readable',
    failure_reason,
    failure_detail,
    processing_time_ms: Math.round(performance.now() - startedAt),
    ocr_quality,
  };
}

function unreadableArtifact(
  file: File,
  startedAt: number,
  reason: ReadingFailureReason,
  detail: string,
): ReadingArtifact {
  const route = resolveReadingRoute(file.type);
  const empty = createEmptyArtifact(file.name, file.type, route);
  return {
    ...empty,
    parser_used: 'paddle_pp_structure_v3',
    reader_implementation: 'paddle_self_hosted',
    readability: 'unreadable',
    is_readable: false,
    failure_reason: reason,
    failure_detail: detail,
    processing_time_ms: Math.round(performance.now() - startedAt),
  };
}

export const paddleReader: DocumentReader & {
  readWithStorage: (input: PaddleReadInput) => Promise<ReadingArtifact>;
} = {
  implementation: 'paddle_self_hosted',

  async readDocumentArtifact(file: File): Promise<ReadingArtifact> {
    const startedAt = performance.now();
    return unreadableArtifact(
      file,
      startedAt,
      'reader_crashed',
      'paddle_requires_storage_path',
    );
  },

  async readWithStorage(input: PaddleReadInput): Promise<ReadingArtifact> {
    const { file, storage_path, document_id, file_id, storage_bucket } = input;
    const startedAt = performance.now();

    const route = resolveReadingRoute(file.type);
    if (route === 'unsupported') {
      return unreadableArtifact(
        file,
        startedAt,
        'unsupported_file_type',
        `paddle_reading:mime=${file.type}`,
      );
    }

    let envelope: Awaited<ReturnType<typeof callPaddleStructureProxy>>;
    try {
      envelope = await callPaddleStructureProxy({
        document_id,
        storage_path,
        storage_bucket,
        file_id,
        mime_type: file.type || 'application/octet-stream',
        file_name: file.name,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown_error';
      return unreadableArtifact(file, startedAt, 'reader_crashed', `paddle_network:client_exception:${msg}`);
    }

    if (!envelope.ok || !envelope.result) {
      const stage = envelope.stage ?? 'provider';
      const reason = envelope.reason ?? 'paddle_unavailable';
      const detail = `paddle_${stage}:${reason}${envelope.error_message ? `:${envelope.error_message}` : ''}`.slice(0, 240);
      return unreadableArtifact(file, startedAt, 'reader_crashed', detail);
    }

    // Cache the raw response so resolveStructuredArtifact() can reuse it
    // without a second network round-trip.
    const result = envelope.result as PaddleStructureResponse;
    storePaddleResponse(document_id, result);
    return buildArtifactFromPaddle(result, file, startedAt);
  },
};
