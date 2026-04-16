// ═══════════════════════════════════════════════════════════════
// OCR Reader — Door 1: Tesseract.js-based text extraction
// ═══════════════════════════════════════════════════════════════
// Handles image files and scanned PDF pages via Tesseract.js.
// Returns structured PageReading[] for the reading artifact.
// ═══════════════════════════════════════════════════════════════

import type { PageReading, TextBlock } from '../reading-artifact-model';

export interface OcrResult {
  ok: boolean;
  pages: PageReading[];
  error?: string;
  processing_time_ms: number;
}

/**
 * OCR a single image file (JPEG/PNG/WEBP).
 * Returns a single-page reading.
 */
export async function ocrImageFile(file: File): Promise<OcrResult> {
  const start = performance.now();
  try {
    const Tesseract = await import('tesseract.js');
    const worker = await Tesseract.createWorker('eng+ara', undefined, {
      logger: () => {}, // silent
    });

    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: file.type });
    const url = URL.createObjectURL(blob);

    try {
      const { data } = await worker.recognize(url);
      await worker.terminate();

      const blocks: TextBlock[] = (data.lines || []).map(
        (line: any, idx: number) => ({
          page: 1,
          text: line.text?.trim() || '',
          type: 'line' as const,
        })
      );

      const fullText = data.text?.trim() || '';
      const page: PageReading = {
        page_number: 1,
        text: fullText,
        blocks,
        char_count: fullText.length,
        has_content: fullText.length > 10,
      };

      return {
        ok: true,
        pages: [page],
        processing_time_ms: performance.now() - start,
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (err) {
    return {
      ok: false,
      pages: [],
      error: err instanceof Error ? err.message : 'OCR failed',
      processing_time_ms: performance.now() - start,
    };
  }
}

/**
 * OCR pages from a scanned PDF by rendering each page to canvas.
 * Uses pdfjs to render + Tesseract to OCR.
 */
export async function ocrPdfPages(
  file: File,
  maxPages = 10,
): Promise<OcrResult> {
  const start = performance.now();
  try {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

    const Tesseract = await import('tesseract.js');
    const worker = await Tesseract.createWorker('eng+ara', undefined, {
      logger: () => {},
    });

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pagesToProcess = Math.min(pdf.numPages, maxPages);
    const pages: PageReading[] = [];

    for (let i = 1; i <= pagesToProcess; i++) {
      const pdfPage = await pdf.getPage(i);
      const viewport = pdfPage.getViewport({ scale: 2.0 }); // Higher DPI for OCR

      // Render to canvas
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      await pdfPage.render({ canvasContext: ctx, viewport }).promise;

      // Convert canvas to blob for Tesseract
      const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, 'image/png')
      );
      if (!blob) continue;

      const url = URL.createObjectURL(blob);
      try {
        const { data } = await worker.recognize(url);

        const blocks: TextBlock[] = (data.lines || []).map(
          (line: any) => ({
            page: i,
            text: line.text?.trim() || '',
            type: 'line' as const,
          })
        );

        const pageText = data.text?.trim() || '';
        pages.push({
          page_number: i,
          text: pageText,
          blocks,
          char_count: pageText.length,
          has_content: pageText.length > 10,
        });
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    await worker.terminate();

    return {
      ok: true,
      pages,
      processing_time_ms: performance.now() - start,
    };
  } catch (err) {
    return {
      ok: false,
      pages: [],
      error: err instanceof Error ? err.message : 'PDF OCR failed',
      processing_time_ms: performance.now() - start,
    };
  }
}
