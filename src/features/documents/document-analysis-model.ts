// ═══════════════════════════════════════════════════════════════
// Document Analysis Model — Door 3: Internal document understanding
// ═══════════════════════════════════════════════════════════════
// Tracks analysis state for each uploaded document.
// No external LLM. No OpenAI. No Oryxa. No fake AI claims.
// Analysis = internal parsers (PDF text, MRZ, regex heuristics).
// ═══════════════════════════════════════════════════════════════

import type { DocumentSlotType, ReadabilityStatus, UsefulnessStatus, DuplicateStatus } from './document-registry-model';

// ── Analysis status ──────────────────────────────────────────
export type AnalysisStatus =
  | 'pending'          // queued for analysis
  | 'analyzing'        // parser running
  | 'completed'        // analysis finished (may have partial results)
  | 'failed'           // parser crashed or file unreadable
  | 'skipped';         // unsupported file type, no analysis attempted

// ── Parser type ──────────────────────────────────────────────
export type ParserType =
  | 'pdf_text'         // pdfjs text extraction
  | 'mrz'              // Machine Readable Zone parser
  | 'image_ocr'        // future: Tesseract.js
  | 'regex_heuristic'  // pattern-based extraction
  | 'filename_only'    // only filename was used (fallback)
  | 'none';            // no parser ran

// ── Classification result ────────────────────────────────────
export type ClassificationResult = DocumentSlotType;

// ── Supported classification targets (Door 3 V1) ────────────
export const DOOR3_SUPPORTED_SLOTS: DocumentSlotType[] = [
  'passport',
  'graduation_certificate',
  'transcript',
  'language_certificate',
];

// ── Extracted field with confidence ──────────────────────────
export interface ExtractedField {
  value: string | number | null;
  raw_text: string | null;        // original text before normalization
  confidence: number;             // 0.0–1.0
  parser_source: ParserType;      // which parser produced this
  evidence_snippet: string | null; // surrounding text that supports this extraction
}

// ── The Document Analysis Record ─────────────────────────────
export interface DocumentAnalysis {
  /** References DocumentRecord.document_id */
  document_id: string;
  /** Slot hint from Door 2 (filename-based) */
  slot_hint: DocumentSlotType | null;
  /** Analysis pipeline status */
  analysis_status: AnalysisStatus;
  /** Which parser was used */
  parser_type: ParserType;
  /** Classification result from content analysis */
  classification_result: ClassificationResult | null;
  /** Classification confidence 0.0–1.0 */
  classification_confidence: number;
  /** Extracted fields keyed by canonical field path (e.g. "identity.passport_name") */
  extracted_fields: Record<string, ExtractedField>;
  /** Confidence map — same keys as extracted_fields, values are confidences */
  field_confidence_map: Record<string, number>;
  /** Readability assessment */
  readability_status: ReadabilityStatus;
  /** Usefulness assessment */
  usefulness_status: UsefulnessStatus;
  /** Duplicate detection */
  duplicate_status: DuplicateStatus;
  /** Rejection reason if file was rejected */
  rejection_reason: string | null;
  /** Internal summary (not for student display — for staff/debug) */
  summary_message_internal: string | null;
  /** Raw text content extracted from document (for downstream use like transcript parsing) */
  text_content: string | null;
  /** Timestamps */
  created_at: string;
  updated_at: string;
}

// ── Factory ──────────────────────────────────────────────────

export function createPendingAnalysis(documentId: string, slotHint: DocumentSlotType | null): DocumentAnalysis {
  const now = new Date().toISOString();
  return {
    document_id: documentId,
    slot_hint: slotHint,
    analysis_status: 'pending',
    parser_type: 'none',
    classification_result: null,
    classification_confidence: 0,
    extracted_fields: {},
    field_confidence_map: {},
    readability_status: 'unknown',
    usefulness_status: 'unknown',
    duplicate_status: 'unknown',
    rejection_reason: null,
    summary_message_internal: null,
    text_content: null,
    created_at: now,
    updated_at: now,
  };
}
