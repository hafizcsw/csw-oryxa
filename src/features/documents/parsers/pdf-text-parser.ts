// ═══════════════════════════════════════════════════════════════
// PDF Text Parser — Door 1: Extract raw text from PDF files
// ═══════════════════════════════════════════════════════════════
// Uses pdf.js (pdfjs-dist) to extract text content from PDFs.
// Returns structured PageReading[] and detects born-digital
// vs scanned (low/no text) PDFs using a 3-signal heuristic.
// ═══════════════════════════════════════════════════════════════

import type { PageReading, TextBlock } from '../reading-artifact-model';

export interface PdfTextResult {
  ok: boolean;
  pages: PageReading[];
  pageCount: number;
  is_born_digital: boolean;
  /** Detection signals for transparency */
  detection_signals?: { avgChars: number; contentRatio: number; avgItems: number };
  error?: string;
  processing_time_ms: number;
}

/** Minimum average chars per page to consider PDF born-digital */
const BORN_DIGITAL_CHAR_THRESHOLD = 50;
/** Minimum ratio of pages with real content */
const BORN_DIGITAL_PAGE_RATIO = 0.4;
/** Minimum average text items per page (font-embedded glyphs) */
const BORN_DIGITAL_ITEMS_THRESHOLD = 5;

/**
 * Extract text from a PDF file using pdf.js.
 * Returns structured page readings and born-digital detection.
 */
export async function extractPdfText(file: File, maxPages = 10): Promise<PdfTextResult> {
  const start = performance.now();
  try {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const pagesToProcess = Math.min(pdf.numPages, maxPages);
    const pages: PageReading[] = [];
    const itemCounts: number[] = [];

    for (let i = 1; i <= pagesToProcess; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();

      const blocks: TextBlock[] = [];
      let currentLine = '';
      let lastY: number | null = null;
      let textItemCount = 0;

      for (const item of content.items) {
        const textItem = item as any;
        if (!textItem.str) continue;
        textItemCount++;

        const y = textItem.transform?.[5];
        if (lastY !== null && y !== undefined && Math.abs(y - lastY) > 3) {
          if (currentLine.trim()) {
            blocks.push({ page: i, text: currentLine.trim(), type: 'line' });
          }
          currentLine = textItem.str;
        } else {
          currentLine += (currentLine ? ' ' : '') + textItem.str;
        }
        if (y !== undefined) lastY = y;
      }
      if (currentLine.trim()) {
        blocks.push({ page: i, text: currentLine.trim(), type: 'line' });
      }

      const pageText = blocks.map(b => b.text).join('\n');
      pages.push({
        page_number: i,
        text: pageText,
        blocks,
        char_count: pageText.length,
        has_content: pageText.trim().length > 10,
      });
      itemCounts.push(textItemCount);
    }

    // ── Born-digital detection (3-signal) ──────────────────────
    // 1. avgChars  — average characters per page
    // 2. contentRatio — ratio of pages with >10 chars
    // 3. avgItems — average pdf.js text items per page (font glyphs)
    // All three must pass. Scanned PDFs score 0 on all three.
    const totalChars = pages.reduce((sum, p) => sum + p.char_count, 0);
    const avgChars = pagesToProcess > 0 ? totalChars / pagesToProcess : 0;
    const pagesWithContent = pages.filter(p => p.has_content).length;
    const contentRatio = pagesToProcess > 0 ? pagesWithContent / pagesToProcess : 0;
    const totalItems = itemCounts.reduce((sum, c) => sum + c, 0);
    const avgItems = pagesToProcess > 0 ? totalItems / pagesToProcess : 0;

    const is_born_digital =
      avgChars >= BORN_DIGITAL_CHAR_THRESHOLD &&
      contentRatio >= BORN_DIGITAL_PAGE_RATIO &&
      avgItems >= BORN_DIGITAL_ITEMS_THRESHOLD;

    return {
      ok: true,
      pages,
      pageCount: pdf.numPages,
      is_born_digital,
      detection_signals: { avgChars, contentRatio, avgItems },
      processing_time_ms: performance.now() - start,
    };
  } catch (err) {
    return {
      ok: false,
      pages: [],
      pageCount: 0,
      is_born_digital: false,
      error: err instanceof Error ? err.message : 'PDF parsing failed',
      processing_time_ms: performance.now() - start,
    };
  }
}
