// ═══════════════════════════════════════════════════════════════
// Reading Artifact Model — Door 1: Structured reading output
// ═══════════════════════════════════════════════════════════════
// The unified artifact produced by the reading core before any
// field extraction or classification. One artifact per file.
// ═══════════════════════════════════════════════════════════════

// ── Reading route ────────────────────────────────────────────
export type ReadingRoute =
  | 'born_digital_pdf'   // PDF with embedded text layer
  | 'scanned_pdf'        // PDF with images only (needs OCR)
  | 'image'              // JPEG/PNG/WEBP (needs OCR)
  | 'unsupported';       // Cannot process

// ── Parser used ──────────────────────────────────────────────
export type ReaderParser =
  | 'pdfjs_text'         // pdfjs-dist text extraction
  | 'tesseract_ocr'      // Tesseract.js OCR
  | 'pdfjs_render_ocr'   // PDF rendered to canvas → OCR
  | 'none';              // no parser could run

// ── Text block (preserves structure) ─────────────────────────
export interface TextBlock {
  /** Page number (1-indexed) */
  page: number;
  /** Raw text content of this block */
  text: string;
  /** Block type hint */
  type: 'paragraph' | 'line' | 'table_row' | 'unknown';
}

// ── Page-level reading result ────────────────────────────────
export interface PageReading {
  /** Page number (1-indexed) */
  page_number: number;
  /** Full text of this page */
  text: string;
  /** Structured blocks if available */
  blocks: TextBlock[];
  /** Character count */
  char_count: number;
  /** Was any text extracted? */
  has_content: boolean;
}

// ── The Reading Artifact ─────────────────────────────────────
export interface ReadingArtifact {
  /** Which route was chosen */
  chosen_route: ReadingRoute;
  /** Which parser actually ran */
  parser_used: ReaderParser;
  /** Per-page reading results */
  pages: PageReading[];
  /** Total page count in original document */
  total_page_count: number;
  /** Pages actually processed (may be capped) */
  pages_processed: number;
  /** Full concatenated text */
  full_text: string;
  /** Overall reading confidence 0.0–1.0 */
  confidence: number;
  /** True if document has usable text */
  is_readable: boolean;
  /** Failure reason if reading failed */
  failure_reason: string | null;
  /** Processing time in ms */
  processing_time_ms: number;
  /** MIME type of input */
  input_mime: string;
  /** Original file name */
  input_filename: string;
}

// ── Factory ──────────────────────────────────────────────────

export function createEmptyArtifact(
  filename: string,
  mime: string,
  route: ReadingRoute,
): ReadingArtifact {
  return {
    chosen_route: route,
    parser_used: 'none',
    pages: [],
    total_page_count: 0,
    pages_processed: 0,
    full_text: '',
    confidence: 0,
    is_readable: false,
    failure_reason: null,
    processing_time_ms: 0,
    input_mime: mime,
    input_filename: filename,
  };
}

// ── Helpers ──────────────────────────────────────────────────

/** Determine reading route from MIME type */
export function resolveReadingRoute(mimeType: string): ReadingRoute {
  if (mimeType === 'application/pdf') {
    // Route will be refined to born_digital or scanned after text extraction attempt
    return 'born_digital_pdf';
  }
  if (
    mimeType === 'image/jpeg' ||
    mimeType === 'image/png' ||
    mimeType === 'image/webp' ||
    mimeType === 'image/jpg'
  ) {
    return 'image';
  }
  return 'unsupported';
}

/** Build full_text from pages */
export function assembleFullText(pages: PageReading[]): string {
  return pages
    .filter(p => p.has_content)
    .map(p => p.text)
    .join('\n\n');
}

/** Calculate overall confidence from page readings */
export function calculateReadingConfidence(pages: PageReading[]): number {
  if (pages.length === 0) return 0;
  const readable = pages.filter(p => p.has_content).length;
  return readable / pages.length;
}
