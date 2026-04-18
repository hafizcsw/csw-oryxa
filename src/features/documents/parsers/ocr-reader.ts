// ═══════════════════════════════════════════════════════════════
// OCR Reader — Door 1: Tesseract.js-based text extraction
// ═══════════════════════════════════════════════════════════════
// TEMPORARY: Client-side OCR via Tesseract.js in the browser.
// This is NOT the final internal engine. A server-side OCR worker
// (edge function or dedicated service) will replace this path.
// This exists to prove the routing + artifact pipeline end-to-end.
//
// Languages: eng + ara (covers Latin + Arabic; MRZ is OCR-B Latin
// so eng alone reads it cleanly — ara is for the body text).
// Preprocessing: upscale + grayscale + contrast for camera shots.
// ═══════════════════════════════════════════════════════════════

import type { PageReading, TextBlock } from '../reading-artifact-model';

export interface OcrResult {
  ok: boolean;
  pages: PageReading[];
  error?: string;
  processing_time_ms: number;
}

const OCR_LANGS = 'eng+ara';
const TARGET_MIN_WIDTH = 1600; // Camera shots often <1200px — upscale for OCR-B

/**
 * Preprocess an image for OCR:
 *  - Upscale small images so MRZ characters are tall enough
 *  - Convert to grayscale + bump contrast (helps glare/shadow on passports)
 * Returns a PNG blob ready for Tesseract.
 */
async function preprocessImageBlob(srcBlob: Blob): Promise<Blob> {
  const url = URL.createObjectURL(srcBlob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('image_decode_failed'));
      el.src = url;
    });

    const scale = img.width < TARGET_MIN_WIDTH ? TARGET_MIN_WIDTH / img.width : 1;
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return srcBlob;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);

    // Grayscale + contrast bump
    try {
      const data = ctx.getImageData(0, 0, w, h);
      const px = data.data;
      const contrast = 1.25; // mild contrast boost
      const intercept = 128 * (1 - contrast);
      for (let i = 0; i < px.length; i += 4) {
        const gray = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
        const v = Math.max(0, Math.min(255, gray * contrast + intercept));
        px[i] = px[i + 1] = px[i + 2] = v;
      }
      ctx.putImageData(data, 0, 0);
    } catch {
      // Tainted canvas or CSP — fall through with the raw upscale
    }

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/png'),
    );
    return blob ?? srcBlob;
  } catch {
    return srcBlob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * OCR a single image file (JPEG/PNG/WEBP).
 * Returns a single-page reading.
 */
export async function ocrImageFile(file: File): Promise<OcrResult> {
  const start = performance.now();
  try {
    const Tesseract = await import('tesseract.js');
    const worker = await Tesseract.createWorker(OCR_LANGS, undefined, {
      logger: () => {}, // silent
    });

    const arrayBuffer = await file.arrayBuffer();
    const rawBlob = new Blob([arrayBuffer], { type: file.type });
    const blob = await preprocessImageBlob(rawBlob);
    const url = URL.createObjectURL(blob);

    try {
      const { data } = await worker.recognize(url);
      await worker.terminate();

      const blocks: TextBlock[] = (data.lines || []).map(
        (line: any) => ({
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
    const worker = await Tesseract.createWorker(OCR_LANGS, undefined, {
      logger: () => {},
    });

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pagesToProcess = Math.min(pdf.numPages, maxPages);
    const pages: PageReading[] = [];

    for (let i = 1; i <= pagesToProcess; i++) {
      try {
        const pdfPage = await pdf.getPage(i);
        const viewport = pdfPage.getViewport({ scale: 2.0 }); // Higher DPI for OCR

        // Render to canvas
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        await pdfPage.render({ canvasContext: ctx, viewport }).promise;

        // Convert canvas to blob → preprocess → Tesseract
        const rawBlob = await new Promise<Blob | null>(resolve =>
          canvas.toBlob(resolve, 'image/png'),
        );
        if (!rawBlob) continue;

        const blob = await preprocessImageBlob(rawBlob);
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
      } catch (pageErr) {
        // Per-page failure must not kill the whole document.
        console.warn(`[OCR] page ${i} failed:`, pageErr);
        continue;
      }
    }

    await worker.terminate();

    return {
      ok: pages.length > 0,
      pages,
      error: pages.length === 0 ? 'all_pages_failed' : undefined,
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
