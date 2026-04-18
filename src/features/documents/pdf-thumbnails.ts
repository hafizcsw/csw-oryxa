// ═══════════════════════════════════════════════════════════════
// pdf-thumbnails — Render every page of a PDF to a JPEG object URL
// ═══════════════════════════════════════════════════════════════
// Used by the upload visualizer to show LIVE multi-page previews
// while the file is being scanned. Pages cycle in the visualizer
// independently of this rendering step.
//
// Notes:
//   - Uses pdfjs-dist legacy build (works in Vite SSR-free contexts)
//   - Worker is loaded from the same package via Vite ?url import
//   - Renders at 1.4x scale by default (good balance for thumbnails)
//   - All produced object URLs MUST be revoked by the caller
// ═══════════════════════════════════════════════════════════════

import * as pdfjsLib from "pdfjs-dist";
// Vite-friendly worker loading: ship the worker as an asset
// eslint-disable-next-line import/no-unresolved
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Set the worker exactly once
let workerSet = false;
function ensureWorker() {
  if (workerSet) return;
  try {
    (pdfjsLib as unknown as { GlobalWorkerOptions: { workerSrc: string } })
      .GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
    workerSet = true;
  } catch {
    /* noop — best effort */
  }
}

export interface PdfThumbnailResult {
  /** Object URLs for each rendered page (caller must revoke) */
  pageUrls: string[];
  /** Total number of pages rendered */
  pageCount: number;
}

/**
 * Render every page of a PDF File to JPEG object URLs.
 * Caller is responsible for revoking the returned URLs.
 */
export async function renderPdfPagesToThumbnails(
  file: File,
  options: { scale?: number; maxPages?: number; quality?: number } = {},
): Promise<PdfThumbnailResult> {
  const { scale = 1.4, maxPages = 30, quality = 0.82 } = options;
  ensureWorker();

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const total = Math.min(pdf.numPages, maxPages);
  const pageUrls: string[] = [];

  for (let pageNum = 1; pageNum <= total; pageNum++) {
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      await page.render({ canvasContext: ctx, viewport, canvas }).promise;

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", quality),
      );
      if (blob) {
        pageUrls.push(URL.createObjectURL(blob));
      }
    } catch {
      // Skip unreadable pages but keep going
    }
  }

  return { pageUrls, pageCount: pageUrls.length };
}
