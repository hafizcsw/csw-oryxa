// ═══════════════════════════════════════════════════════════════
// Document Reader Contract — Door 1: Reading-stage isolation
// ═══════════════════════════════════════════════════════════════
// The ONLY surface analysis-engine.ts is allowed to touch for
// reading. Every concrete implementation must satisfy this
// contract and return a normalized ReadingArtifact.
//
// CUTOVER STATE (Soft cutover, primary = Paddle):
//   1. PRIMARY:  paddleReader (PP-StructureV3 via edge proxy)
//   2. FALLBACK: legacyBrowserReader (pdf.js + Tesseract.js)
//
// Behavior:
//   - readDocumentArtifact(file, ctx) tries Paddle when storage_path
//     is provided AND mime is supported. On Paddle failure (any
//     failure_reason ≠ unsupported_file_type), legacy is invoked
//     and the artifact is tagged reader_implementation =
//     'legacy_browser_fallback' so audit can prove what happened.
//   - When no storage_path is provided, legacy runs directly and
//     is tagged 'legacy_browser' (e.g. local previews/tests).
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

/** Optional context: lets the router pick Paddle (primary) when a
 *  storage_path exists. Without it, legacy runs directly. */
export interface ReadContext {
  storage_path?: string | null;
  document_id?: string | null;
}

// ── Lazy imports (heavy parsers should not load until needed) ──
async function getLegacyReader(): Promise<DocumentReader> {
  const mod = await import('./parsers/legacy-browser-reader');
  return mod.legacyBrowserReader;
}

async function getPaddleReader() {
  const mod = await import('./parsers/paddle-reader');
  return mod.paddleReader;
}

/** Decide if the Paddle path should be attempted for this file. */
function shouldTryPaddle(file: File, ctx?: ReadContext): boolean {
  if (!ctx?.storage_path || !ctx.document_id) return false;
  const mime = file.type || '';
  // Paddle only handles PDF + image. Office docs short-circuit to legacy
  // (which itself reports unsupported_file_type for them — same outcome,
  // but at least we do not waste a Paddle round-trip).
  return mime === 'application/pdf' || mime.startsWith('image/');
}

/** Convenience: read a file via the active reader strategy.
 *  Pass `ctx.storage_path` + `ctx.document_id` to enable the Paddle
 *  primary path; omit them to force legacy direct. */
export async function readDocumentArtifact(
  file: File,
  ctx?: ReadContext,
): Promise<ReadingArtifact> {
  // ── PRIMARY: Paddle ───────────────────────────────────────
  if (shouldTryPaddle(file, ctx)) {
    const paddle = await getPaddleReader();
    const paddleArtifact = await paddle.readWithStorage({
      file,
      storage_path: ctx!.storage_path!,
      document_id: ctx!.document_id!,
    });

    if (paddleArtifact.readability !== 'unreadable') {
      console.log('[DocumentReader] ✓ paddle_self_hosted', {
        file: file.name,
        pages: paddleArtifact.pages_processed,
        chars: paddleArtifact.full_text.length,
        readability: paddleArtifact.readability,
      });
      return paddleArtifact;
    }

    // ── FALLBACK: legacy_browser ───────────────────────────
    console.warn('[DocumentReader] ✗ paddle failed → legacy_browser_fallback', {
      file: file.name,
      failure_reason: paddleArtifact.failure_reason,
      failure_detail: paddleArtifact.failure_detail,
    });
    const legacy = await getLegacyReader();
    const legacyArtifact = await legacy.readDocumentArtifact(file);
    return {
      ...legacyArtifact,
      // Tag explicitly so analytics can prove the cutover state.
      reader_implementation: 'legacy_browser_fallback',
      failure_detail: legacyArtifact.failure_detail
        ? `${legacyArtifact.failure_detail} | paddle_fallback_reason=${paddleArtifact.failure_reason ?? 'unknown'}`
        : `paddle_fallback_reason=${paddleArtifact.failure_reason ?? 'unknown'}`,
    };
  }

  // ── No storage_path: direct legacy (pre-upload preview/tests) ──
  const legacy = await getLegacyReader();
  const artifact = await legacy.readDocumentArtifact(file);
  console.log('[DocumentReader] ⚠ legacy_browser direct (no storage_path)', {
    file: file.name,
    readability: artifact.readability,
  });
  return artifact;
}

/** Lower-level accessor kept for compatibility with code that
 *  needs the legacy reader directly. New code should call
 *  readDocumentArtifact() with a context instead. */
export async function getActiveReader(): Promise<DocumentReader> {
  // The "active" surface is now the router itself, but legacy stays
  // accessible for callers that explicitly want it.
  return getLegacyReader();
}
