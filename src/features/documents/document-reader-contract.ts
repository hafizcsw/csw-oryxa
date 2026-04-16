// ═══════════════════════════════════════════════════════════════
// Document Reader Contract — Door 1: Reading-stage isolation
// ═══════════════════════════════════════════════════════════════
// The ONLY surface analysis-engine.ts is allowed to touch for
// reading. Every concrete implementation (today: legacy browser
// pdf.js + Tesseract; tomorrow: server worker / Paddle) must
// satisfy this contract and return a normalized ReadingArtifact.
//
// Engine MUST NOT import extractPdfText / ocrImageFile /
// ocrPdfPages directly anymore.
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

// ── Active reader (single source of truth) ───────────────────
// Lazy-imported so the heavy parsers are not pulled until needed.
let _activeReader: DocumentReader | null = null;

export async function getActiveReader(): Promise<DocumentReader> {
  if (_activeReader) return _activeReader;
  // TEMP: only legacy browser reader exists today.
  const mod = await import('./parsers/legacy-browser-reader');
  _activeReader = mod.legacyBrowserReader;
  return _activeReader;
}

/** Convenience: read a file via the active reader. */
export async function readDocumentArtifact(file: File): Promise<ReadingArtifact> {
  const reader = await getActiveReader();
  return reader.readDocumentArtifact(file);
}
