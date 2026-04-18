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
  | 'pdfjs_text'              // pdfjs-dist text extraction
  | 'tesseract_ocr'           // Tesseract.js OCR
  | 'pdfjs_render_ocr'        // PDF rendered to canvas → OCR
  | 'paddle_pp_structure_v3'  // self-hosted PaddleOCR PP-StructureV3 (server-side)
  | 'none';                   // no parser could run

// ── Reader implementation tag ────────────────────────────────
// Identifies WHICH reader produced this artifact. Truth surface.
//
// ACTIVE STATE (hard cutover):
//   primary  = paddle_self_hosted (PP-StructureV3 via edge proxy)
//   NO browser fallback in the live router.
//   `legacy_browser*` tags are kept ONLY to read historical artifacts
//   produced before the cutover; they MUST NOT appear on new runs.
export type ReaderImplementation =
  | 'paddle_self_hosted'        // PRIMARY (only live reader)
  | 'legacy_browser_fallback'   // HISTORICAL: pre-cutover fallback artifacts
  | 'legacy_browser'            // HISTORICAL: pre-cutover artifacts
  | 'none';

// ── Reading-stage failure taxonomy ───────────────────────────
// Every reading failure MUST land in one of these buckets.
// "Vague success" is no longer allowed.
export type ReadingFailureReason =
  | 'unsupported_file_type'  // MIME type has no reading lane
  | 'unreadable_scan'        // PDF/image produced no usable text
  | 'low_ocr_quality'        // OCR ran but output is garbage
  | 'reader_crashed'         // parser threw
  | 'empty_document'         // file opened but contained nothing
  | null;                    // no failure

// ── Readability status (honesty gate) ────────────────────────
// readable  : full downstream success allowed
// degraded  : text exists but quality is poor — downstream must be cautious
// unreadable: NO downstream success semantics allowed
export type ArtifactReadability = 'readable' | 'degraded' | 'unreadable';

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

// ── OCR Quality Metrics ──────────────────────────────────────
export interface OcrQualityMetrics {
  /** Ratio of real words to total tokens (0.0–1.0) */
  word_coherence: number;
  /** Ratio of meaningful chars (letters/digits/Arabic) to total chars */
  char_quality: number;
  /** Average token length */
  avg_token_length: number;
  /** Whether text passes quality threshold */
  is_coherent: boolean;
  /** Human-readable quality label */
  quality_label: 'good' | 'partial' | 'garbage';
}

// ── The Reading Artifact ─────────────────────────────────────
export interface ReadingArtifact {
  /** Which route was chosen */
  chosen_route: ReadingRoute;
  /** Which parser actually ran */
  parser_used: ReaderParser;
  /** Which reader implementation produced this artifact (truth surface) */
  reader_implementation: ReaderImplementation;
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
  /** Honest readability verdict (the gate) */
  readability: ArtifactReadability;
  /** Backwards-compat boolean = (readability === 'readable') */
  is_readable: boolean;
  /** Explicit failure bucket. null when nothing failed. */
  failure_reason: ReadingFailureReason;
  /** Optional human-readable detail (debug only — UI uses i18n on failure_reason) */
  failure_detail: string | null;
  /** Processing time in ms */
  processing_time_ms: number;
  /** MIME type of input */
  input_mime: string;
  /** Original file name */
  input_filename: string;
  /** OCR quality metrics (only for OCR routes) */
  ocr_quality?: OcrQualityMetrics;
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
    reader_implementation: 'none',
    pages: [],
    total_page_count: 0,
    pages_processed: 0,
    full_text: '',
    confidence: 0,
    readability: 'unreadable',
    is_readable: false,
    failure_reason: null,
    failure_detail: null,
    processing_time_ms: 0,
    input_mime: mime,
    input_filename: filename,
  };
}

// ── Helpers ──────────────────────────────────────────────────

/** Determine reading route from MIME type.
 *  Must stay in sync with SUPPORTED_MIMES in content-classifier.ts.
 *  DOC/DOCX are NOT supported — no reading lane exists. */
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

// ── OCR Quality Scoring ─────────────────────────────────────
// Detects garbage OCR output by measuring text coherence.
// Works for both English and Arabic text.

// Common short words that prove coherence (EN + AR)
const COHERENCE_WORDS = new Set([
  // English
  'the', 'of', 'and', 'in', 'to', 'for', 'is', 'on', 'at', 'by',
  'with', 'from', 'or', 'an', 'be', 'this', 'that', 'are', 'was',
  'has', 'have', 'had', 'not', 'but', 'all', 'can', 'her', 'his',
  'name', 'date', 'number', 'no', 'yes', 'mr', 'mrs', 'dr',
  'university', 'certificate', 'degree', 'passport', 'student',
  'faculty', 'department', 'college', 'school', 'year', 'grade',
  // Arabic common
  'من', 'في', 'على', 'إلى', 'هذا', 'هذه', 'أن', 'عن', 'مع',
  'لا', 'ما', 'هو', 'هي', 'كل', 'بعد', 'قبل', 'بين', 'حتى',
  'جامعة', 'كلية', 'شهادة', 'طالب', 'اسم', 'تاريخ', 'رقم',
  'بكالوريوس', 'ماجستير', 'تخرج', 'معدل', 'درجة', 'قسم',
]);

/**
 * Assess OCR text quality. Detects garbage output from bad OCR.
 * Uses multiple signals:
 * 1. char_quality: ratio of meaningful chars (letters, digits, Arabic) to total
 * 2. word_coherence: ratio of recognized words to total tokens
 * 3. avg_token_length: garbage tends to produce very short or very long tokens
 */
export function assessOcrQuality(text: string): OcrQualityMetrics {
  if (!text || text.trim().length < 10) {
    return { word_coherence: 0, char_quality: 0, avg_token_length: 0, is_coherent: false, quality_label: 'garbage' };
  }

  const totalChars = text.length;
  const meaningfulChars = (text.match(/[\p{L}\p{N}\s.,;:!?()\-\/]/gu) || []).length;
  const char_quality = meaningfulChars / totalChars;

  const tokens = text
    .toLowerCase()
    .split(/[\s\n\r\t,;:!?()[\]{}<>=+*&^%$#@~`"|\\]+/)
    .filter(t => t.length >= 2);

  if (tokens.length === 0) {
    return { word_coherence: 0, char_quality, avg_token_length: 0, is_coherent: false, quality_label: 'garbage' };
  }

  let coherentCount = 0;
  let totalLength = 0;

  for (const token of tokens) {
    totalLength += token.length;
    if (COHERENCE_WORDS.has(token)) {
      coherentCount++;
      continue;
    }
    if (/^[\p{L}]{3,}$/u.test(token)) {
      const consonantClusters = token.match(/[^aeiouأإاوي\s]{4,}/gi) || [];
      if (consonantClusters.length === 0) {
        coherentCount++;
      }
    }
    if (/^\d{1,4}([.\-\/]\d{1,4}){0,2}$/.test(token)) {
      coherentCount++;
    }
  }

  const word_coherence = coherentCount / tokens.length;
  const avg_token_length = totalLength / tokens.length;

  let quality_label: OcrQualityMetrics['quality_label'];
  let is_coherent: boolean;

  if (char_quality > 0.85 && word_coherence > 0.4) {
    quality_label = 'good';
    is_coherent = true;
  } else if (char_quality > 0.7 && word_coherence > 0.2) {
    quality_label = 'partial';
    is_coherent = true; // partial is still usable — but engine marks as 'degraded'
  } else {
    quality_label = 'garbage';
    is_coherent = false;
  }

  return { word_coherence, char_quality, avg_token_length, is_coherent, quality_label };
}
