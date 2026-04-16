// ═══════════════════════════════════════════════════════════════
// PDF Text Parser — Door 1: Extract raw text from PDF files
// ═══════════════════════════════════════════════════════════════
// Uses pdf.js (pdfjs-dist) to extract text content from PDFs.
// Now returns structured PageReading[] and detects born-digital
// vs scanned (low/no text) PDFs.
// ═══════════════════════════════════════════════════════════════

import type { PageReading, TextBlock } from '../reading-artifact-model';

export interface PdfTextResult {
  ok: boolean;
  /** Structured page readings */
  pages: PageReading[];
  /** Total pages in document */
  pageCount: number;
  /** True if enough text was extracted to consider it born-digital */
  is_born_digital: boolean;
  /** Error message if failed */
  error?: string;
  /** Processing time ms */
  processing_time_ms: number;
}

/** Minimum average chars per page to consider PDF born-digital */
const BORN_DIGITAL_THRESHOLD = 30;

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

    for (let i = 1; i <= pagesToProcess; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();

      // Build blocks from text items — group by vertical position (approximate lines)
      const blocks: TextBlock[] = [];
      let currentLine = '';
      let lastY: number | null = null;

      for (const item of content.items) {
        const textItem = item as any;
        if (!textItem.str) continue;

        const y = textItem.transform?.[5];
        if (lastY !== null && y !== undefined && Math.abs(y - lastY) > 3) {
          // New line
          if (currentLine.trim()) {
            blocks.push({
              page: i,
              text: currentLine.trim(),
              type: 'line',
            });
          }
          currentLine = textItem.str;
        } else {
          currentLine += (currentLine ? ' ' : '') + textItem.str;
        }
        if (y !== undefined) lastY = y;
      }
      // Push last line
      if (currentLine.trim()) {
        blocks.push({
          page: i,
          text: currentLine.trim(),
          type: 'line',
        });
      }

      const pageText = blocks.map(b => b.text).join('\n');
      pages.push({
        page_number: i,
        text: pageText,
        blocks,
        char_count: pageText.length,
        has_content: pageText.trim().length > 10,
      });
    }

    // Determine if born-digital: average chars across processed pages
    const totalChars = pages.reduce((sum, p) => sum + p.char_count, 0);
    const avgChars = pagesToProcess > 0 ? totalChars / pagesToProcess : 0;
    const is_born_digital = avgChars >= BORN_DIGITAL_THRESHOLD;

    return {
      ok: true,
      pages,
      pageCount: pdf.numPages,
      is_born_digital,
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
