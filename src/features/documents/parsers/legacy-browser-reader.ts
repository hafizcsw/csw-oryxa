// ═══════════════════════════════════════════════════════════════
// Legacy Browser Reader — Door 1: TEMPORARY reader implementation
// ═══════════════════════════════════════════════════════════════
// THIS IS NOT THE FINAL ENGINE.
// It wraps the current in-browser implementations:
//   - pdf.js text extraction
//   - Tesseract.js OCR (image + scanned PDF)
// behind the DocumentReader contract so the rest of the pipeline
// never imports them directly.
//
// To replace this reader (server worker, Paddle, etc.) you only
// need to swap the export inside document-reader-contract.ts.
// Engine, hooks and UI must NOT change.
// ═══════════════════════════════════════════════════════════════

import {
  type ReadingArtifact,
  createEmptyArtifact,
  resolveReadingRoute,
  assembleFullText,
  calculateReadingConfidence,
  assessOcrQuality,
} from '../reading-artifact-model';
import type { DocumentReader } from '../document-reader-contract';
import { extractPdfText } from './pdf-text-parser';
import { ocrImageFile, ocrPdfPages } from './ocr-reader';

async function readArtifact(file: File): Promise<ReadingArtifact> {
  const start = performance.now();
  const route = resolveReadingRoute(file.type);
  const artifact = createEmptyArtifact(file.name, file.type, route);
  artifact.reader_implementation = 'legacy_browser';

  try {
    // ── Unsupported MIME ─────────────────────────────────────
    if (route === 'unsupported') {
      artifact.failure_reason = 'unsupported_file_type';
      artifact.failure_detail = `MIME ${file.type || '(empty)'} has no reading lane`;
      artifact.readability = 'unreadable';
      artifact.is_readable = false;
      artifact.processing_time_ms = performance.now() - start;
      return artifact;
    }

    // ── Image lane ───────────────────────────────────────────
    if (route === 'image') {
      const ocrResult = await ocrImageFile(file);
      artifact.parser_used = 'tesseract_ocr';

      if (!ocrResult.ok || ocrResult.pages.length === 0) {
        artifact.failure_reason = 'unreadable_scan';
        artifact.failure_detail = ocrResult.error || 'OCR produced no pages';
        artifact.readability = 'unreadable';
        artifact.is_readable = false;
      } else {
        artifact.pages = ocrResult.pages;
        artifact.pages_processed = ocrResult.pages.length;
        artifact.total_page_count = 1;
        artifact.full_text = assembleFullText(ocrResult.pages);
        artifact.confidence = calculateReadingConfidence(ocrResult.pages);

        const quality = assessOcrQuality(artifact.full_text);
        artifact.ocr_quality = quality;
        applyOcrGate(artifact, quality);
      }
      artifact.processing_time_ms = performance.now() - start;
      return artifact;
    }

    // ── PDF lane ─────────────────────────────────────────────
    const pdfResult = await extractPdfText(file);
    if (pdfResult.detection_signals) {
      console.info('[Door1:LegacyReader:PdfDetection]', {
        file: file.name,
        is_born_digital: pdfResult.is_born_digital,
        ...pdfResult.detection_signals,
      });
    }

    if (pdfResult.ok && pdfResult.is_born_digital) {
      artifact.chosen_route = 'born_digital_pdf';
      artifact.parser_used = 'pdfjs_text';
      artifact.pages = pdfResult.pages;
      artifact.total_page_count = pdfResult.pageCount;
      artifact.pages_processed = pdfResult.pages.length;
      artifact.full_text = assembleFullText(pdfResult.pages);
      artifact.confidence = calculateReadingConfidence(pdfResult.pages);

      if (artifact.full_text.trim().length === 0) {
        // Born-digital flag passed but text is empty — honest failure
        artifact.failure_reason = 'empty_document';
        artifact.failure_detail = 'PDF reported born-digital but no text was extracted';
        artifact.readability = 'unreadable';
        artifact.is_readable = false;
      } else {
        artifact.readability = 'readable';
        artifact.is_readable = true;
      }
      artifact.processing_time_ms = performance.now() - start;
      return artifact;
    }

    // Scanned PDF → render + OCR
    artifact.chosen_route = 'scanned_pdf';
    const ocrResult = await ocrPdfPages(file);
    artifact.parser_used = 'pdfjs_render_ocr';

    if (!ocrResult.ok || ocrResult.pages.length === 0) {
      artifact.failure_reason = 'unreadable_scan';
      artifact.failure_detail = ocrResult.error || 'Scanned PDF OCR produced no pages';
      artifact.readability = 'unreadable';
      artifact.is_readable = false;
    } else {
      artifact.pages = ocrResult.pages;
      artifact.total_page_count = pdfResult.pageCount || ocrResult.pages.length;
      artifact.pages_processed = ocrResult.pages.length;
      artifact.full_text = assembleFullText(ocrResult.pages);
      artifact.confidence = calculateReadingConfidence(ocrResult.pages);

      const quality = assessOcrQuality(artifact.full_text);
      artifact.ocr_quality = quality;
      applyOcrGate(artifact, quality);
    }
    artifact.processing_time_ms = performance.now() - start;
    return artifact;
  } catch (err) {
    artifact.failure_reason = 'reader_crashed';
    artifact.failure_detail = err instanceof Error ? err.message : 'Unknown reader crash';
    artifact.readability = 'unreadable';
    artifact.is_readable = false;
    artifact.processing_time_ms = performance.now() - start;
    return artifact;
  }
}

/**
 * MRZ rescue: detect if OCR output contains a viable MRZ pattern.
 * Even garbage-quality OCR can yield a valid MRZ for passports —
 * the MRZ is in OCR-B font designed for machine reading.
 * If detected, we MUST NOT block downstream — passport lane needs MRZ.
 */
function detectMrzPattern(text: string): boolean {
  if (!text) return false;
  const upper = text.toUpperCase().replace(/\s+/g, '');
  // TD3: 2 lines × 44 — look for "<<<<" runs (filler) AND a digits-heavy line
  const hasFiller = /<{4,}/.test(upper);
  // Document line: starts with P/I/A/C followed by letters/<
  const hasDocLine = /[PIAC][A-Z<][A-Z]{3}/.test(upper);
  // Data line: 9 alnum + 1 digit + 3 letters + 6 digits + 1 digit + [MFX<]
  const hasDataLine = /[A-Z0-9<]{9}\d[A-Z]{3}\d{6}\d[MFX<]/.test(upper);
  return hasFiller && (hasDocLine || hasDataLine);
}

/** Honesty gate for OCR routes.
 *  garbage  → unreadable + low_ocr_quality (no downstream success)
 *           UNLESS an MRZ pattern survived → degraded (passport rescue)
 *  partial  → degraded (downstream allowed but flagged)
 *  good     → readable
 */
function applyOcrGate(
  artifact: ReadingArtifact,
  quality: ReturnType<typeof assessOcrQuality>,
): void {
  if (quality.quality_label === 'garbage' || !quality.is_coherent) {
    // MRZ rescue: a viable MRZ in the OCR output overrides garbage verdict.
    if (detectMrzPattern(artifact.full_text)) {
      console.info('[Door1:LegacyReader:MrzRescue]', {
        file: artifact.input_filename,
        quality_label: quality.quality_label,
        char_quality: Number(quality.char_quality.toFixed(2)),
        word_coherence: Number(quality.word_coherence.toFixed(2)),
        action: 'rescued_as_degraded',
      });
      artifact.readability = 'degraded';
      artifact.is_readable = true;
      artifact.confidence = Math.max(artifact.confidence * 0.6, 0.4);
      return;
    }
    artifact.readability = 'unreadable';
    artifact.is_readable = false;
    artifact.failure_reason = 'low_ocr_quality';
    artifact.failure_detail =
      `char_quality=${(quality.char_quality * 100).toFixed(0)}%, ` +
      `word_coherence=${(quality.word_coherence * 100).toFixed(0)}%`;
    artifact.confidence = artifact.confidence * 0.3;
    return;
  }
  if (quality.quality_label === 'partial') {
    artifact.readability = 'degraded';
    artifact.is_readable = true;
    artifact.confidence = artifact.confidence * 0.7;
    return;
  }
  artifact.readability = 'readable';
  artifact.is_readable = true;
}

export const legacyBrowserReader: DocumentReader = {
  implementation: 'legacy_browser',
  readDocumentArtifact: readArtifact,
};
