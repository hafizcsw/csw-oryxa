// ═══════════════════════════════════════════════════════════════
// Document Reader Contract — Door 1: Reading-stage isolation
// ═══════════════════════════════════════════════════════════════
// The ONLY surface analysis-engine.ts is allowed to touch for
// reading. Every concrete implementation must satisfy this
// contract and return a normalized ReadingArtifact.
//
// ACTIVE STATE (hard cutover):
//   1. PRIMARY + ONLY: paddleReader (PP-StructureV3 via edge proxy)
//   2. NO browser fallback in the router
//
// Behavior:
//   - readDocumentArtifact(file, ctx) calls Paddle only when
//     storage_path + document_id are present.
//   - When they are missing, the router FAILS CLOSED and returns an
//     unreadable Paddle-tagged artifact instead of invoking any local
//     browser OCR/parser path.
//   - Engine MUST NOT import extractPdfText / ocrImageFile /
//     ocrPdfPages directly anymore.
// ═══════════════════════════════════════════════════════════════

import type {
  ReadingArtifact,
  ReaderImplementation,
} from './reading-artifact-model';

/** A reader is a strategy that turns a File into a ReadingArtifact. */
export interface DocumentReader {
  /** Stable identifier of the implementation (truth surface). */
  readonly implementation: ReaderImplementation;
  /** Run the full reading stage. MUST never throw — it MUST always
   *  return an artifact whose failure_reason describes what went wrong. */
  readDocumentArtifact(file: File): Promise<ReadingArtifact>;
}

/** Optional context: lets the router pick Paddle when a storage_path exists. */
export interface ReadContext {
  storage_path?: string | null;
  document_id?: string | null;
}

async function getPaddleReader() {
  const mod = await import('./parsers/paddle-reader');
  return mod.paddleReader;
}

/** Decide if the Paddle path should be attempted for this file. */
function shouldTryPaddle(file: File, ctx?: ReadContext): boolean {
  if (!ctx?.storage_path || !ctx.document_id) return false;
  const mime = file.type || '';
  return mime === 'application/pdf' || mime.startsWith('image/');
}

/** Convenience: read a file via the active reader strategy.
 *  Pass `ctx.storage_path` + `ctx.document_id` to enable Paddle.
 *  Without them, this FAILS CLOSED — no legacy browser route remains. */
export async function readDocumentArtifact(
  file: File,
  ctx?: ReadContext,
): Promise<ReadingArtifact> {
  const paddle = await getPaddleReader();

  if (shouldTryPaddle(file, ctx)) {
    const paddleArtifact = await paddle.readWithStorage({
      file,
      storage_path: ctx!.storage_path!,
      document_id: ctx!.document_id!,
    });

    console.log('[DocumentReader] resolved', {
      file: file.name,
      reader_implementation: paddleArtifact.reader_implementation,
      parser_used: paddleArtifact.parser_used,
      readability: paddleArtifact.readability,
      failure_reason: paddleArtifact.failure_reason,
    });
    return paddleArtifact;
  }

  const artifact = await paddle.readDocumentArtifact(file);
  console.warn('[DocumentReader] blocked: missing storage_path/document_id', {
    file: file.name,
    readability: artifact.readability,
    failure_reason: artifact.failure_reason,
    failure_detail: artifact.failure_detail,
  });
  return artifact;
}
