// ═══════════════════════════════════════════════════════════════
// PDF Text Parser — Door 3: Extract raw text from PDF files
// ═══════════════════════════════════════════════════════════════
// Uses pdf.js (pdfjs-dist) to extract text content from PDFs.
// No external LLM. Pure client-side text extraction.
// ═══════════════════════════════════════════════════════════════

export interface PdfTextResult {
  ok: boolean;
  text: string;
  pages: string[];
  pageCount: number;
  error?: string;
}

/**
 * Extract text from a PDF file using pdf.js.
 * Processes up to maxPages (default 10) to avoid blocking.
 */
export async function extractPdfText(file: File, maxPages = 10): Promise<PdfTextResult> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    
    // Set worker source
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    const pagesToProcess = Math.min(pdf.numPages, maxPages);
    const pages: string[] = [];

    for (let i = 1; i <= pagesToProcess; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: any) => item.str)
        .join(' ');
      pages.push(pageText);
    }

    const text = pages.join('\n\n');

    return {
      ok: true,
      text,
      pages,
      pageCount: pdf.numPages,
    };
  } catch (err) {
    return {
      ok: false,
      text: '',
      pages: [],
      pageCount: 0,
      error: err instanceof Error ? err.message : 'PDF parsing failed',
    };
  }
}
