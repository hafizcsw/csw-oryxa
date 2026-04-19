// ═══════════════════════════════════════════════════════════════
// Door 3 — Shared types (OCR evidence contract + parser outputs)
// ═══════════════════════════════════════════════════════════════
// SINGLE SOURCE OF TRUTH for the worker ⇄ edge contract.
// Keep in sync with src/features/documents/door3/types.ts (mirrored).
// ═══════════════════════════════════════════════════════════════

export type Door3JobType =
  | 'internal_ocr'
  | 'transcript_parse'
  | 'passport_recovery'
  | 'certificate_recovery';

export type Door3JobStatus =
  | 'queued'
  | 'worker_not_configured'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'needs_review';

export type OcrContentKind = 'image' | 'scanned_pdf' | 'pdf_text';

export interface OcrLine {
  text: string;
  confidence: number; // 0..1
  bbox?: { x: number; y: number; w: number; h: number };
}

export interface OcrPage {
  page_index: number;
  raw_text: string;
  lines: OcrLine[];
  text_blocks?: Array<{ text: string; confidence: number }>;
}

export interface OcrEvidence {
  document_id: string;
  content_kind: OcrContentKind;
  page_count: number;
  pages: OcrPage[];
  processing_notes: string[];
  engine: string;          // e.g. 'tesseract-native' | 'pdfjs-text-layer'
  engine_version: string | null;
  processed_at: string;    // ISO
}

// ─── Transcript parser output ──────────────────────────────────
export interface TranscriptRow {
  academic_period: string | null;
  subject_name_raw: string | null;
  subject_name_normalized: string | null;
  mark_raw: string | null;
  mark_numeric: number | null;
  credit_hours_raw: string | null;
  credit_hours_numeric: number | null;
  grade_raw: string | null;
  row_confidence: number;
  provenance: Record<string, unknown>;
}

export interface TranscriptSummaryMetric {
  metric_type: string;       // 'gpa' | 'cgpa' | 'total_credits' | 'percentage' | ...
  raw_label: string | null;
  normalized_label: string | null;
  raw_value: string | null;
  normalized_numeric_value: number | null;
  confidence: number;
  provenance: Record<string, unknown>;
}

export interface TranscriptParseResult {
  rows: TranscriptRow[];
  summary: TranscriptSummaryMetric[];
  meta: {
    institution_name: string | null;
    student_name: string | null;
    document_language: string | null;
    processing_mode: 'pdf_text' | 'internal_ocr';
  };
  needs_review: boolean;
  notes: string[];
}
