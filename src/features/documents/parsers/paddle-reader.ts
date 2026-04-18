// ═══════════════════════════════════════════════════════════════
// Paddle Reader — Door 1: PRIMARY reader implementation
// ═══════════════════════════════════════════════════════════════
// Implements the DocumentReader contract using the self-hosted
// PaddleOCR PP-StructureV3 service via the `paddle-structure`
// edge proxy.
//
// Returns a full ReadingArtifact (full_text, pages, readability,
// failure_reason) — NOT just a structured overlay. This is the
// real cutover surface: when this reader succeeds, downstream
// extraction runs against Paddle text, not legacy text.
//
// Fail-closed: any failure path returns an unreadable artifact
// with a stable failure_reason. The DocumentReaderRouter (in
// document-reader-contract.ts) decides whether to invoke the
// legacy fallback based on those reasons.
// ═══════════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';
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

/** Storage path is REQUIRED — Paddle reads via signed URL only. */
export interface PaddleReadInput {
  file: File;
  storage_path: string;
  document_id: string;
}

/** Builds the per-page text from Paddle's response, preferring the
 *  pre-assembled `text` field, falling back to concatenating block texts. */
function pageText(p: PaddlePage): string {
  if (typeof p.text === 'string' && p.text.trim().length > 0) return p.text;
  const blocks = p.blocks ?? [];
  return blocks
    .map(b => (b.text ?? '').trim())
    .filter(Boolean)
    .join('\n');
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

  // Readability verdict — honest gate.
  let readability: ReadingArtifact['readability'];
  let failure_reason: ReadingFailureReason = null;
  let failure_detail: string | null = null;

  if (pages.length === 0 || full_text.trim().length === 0) {
    readability = 'unreadable';
    failure_reason = 'unreadable_scan';
    failure_detail = 'paddle_returned_empty_text';
  } else if (ocr_quality.quality_label === 'garbage') {
    readability = 'unreadable';
    failure_reason = 'low_ocr_quality';
    failure_detail = `coherence=${ocr_quality.word_coherence.toFixed(2)} char_q=${ocr_quality.char_quality.toFixed(2)}`;
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

/** PaddleReader — supports PDF and image MIME types. Other types must
 *  be filtered out by the router (DOC/DOCX/XLSX have no reading lane). */
export const paddleReader: DocumentReader & {
  readWithStorage: (input: PaddleReadInput) => Promise<ReadingArtifact>;
} = {
  implementation: 'paddle_self_hosted',

  async readDocumentArtifact(file: File): Promise<ReadingArtifact> {
    // This reader REQUIRES a storage_path. Direct file reads must use
    // readWithStorage() instead. The router will only call this path
    // when storage_path is unavailable, in which case we fail-closed
    // so the legacy reader can take over.
    const startedAt = performance.now();
    return unreadableArtifact(
      file,
      startedAt,
      'reader_crashed',
      'paddle_requires_storage_path',
    );
  },

  async readWithStorage(input: PaddleReadInput): Promise<ReadingArtifact> {
    const { file, storage_path, document_id } = input;
    const startedAt = performance.now();

    const route = resolveReadingRoute(file.type);
    if (route === 'unsupported') {
      return unreadableArtifact(
        file,
        startedAt,
        'unsupported_file_type',
        `mime=${file.type}`,
      );
    }

    let envelope: { ok: boolean; reason?: string; error_message?: string | null; result?: PaddleStructureResponse } | null = null;
    try {
      const { data, error } = await supabase.functions.invoke('paddle-structure', {
        body: {
          document_id,
          storage_path,
          mime_type: file.type || 'application/octet-stream',
          file_name: file.name,
        },
      });
      if (error) {
        return unreadableArtifact(
          file,
          startedAt,
          'reader_crashed',
          `edge_invoke_failed: ${error.message ?? 'unknown'}`,
        );
      }
      envelope = data as typeof envelope;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown_error';
      return unreadableArtifact(file, startedAt, 'reader_crashed', `client_exception: ${msg}`);
    }

    if (!envelope || typeof envelope !== 'object') {
      return unreadableArtifact(file, startedAt, 'reader_crashed', 'empty_envelope');
    }
    if (!envelope.ok || !envelope.result) {
      const reason = envelope.reason ?? 'paddle_unavailable';
      // Map edge-side reason → reading failure bucket.
      const failure: ReadingFailureReason =
        reason === 'no_endpoint_configured' ? 'reader_crashed'
        : reason === 'timeout' ? 'reader_crashed'
        : reason === 'service_5xx' || reason === 'network_error' ? 'reader_crashed'
        : 'reader_crashed';
      return unreadableArtifact(
        file,
        startedAt,
        failure,
        `paddle_${reason}: ${envelope.error_message ?? ''}`.slice(0, 200),
      );
    }

    return buildArtifactFromPaddle(envelope.result, file, startedAt);
  },
};
