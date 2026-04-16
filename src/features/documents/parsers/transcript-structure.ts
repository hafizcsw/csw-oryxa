// ═══════════════════════════════════════════════════════════════
// Transcript Intermediate Structure — Order 2
// ═══════════════════════════════════════════════════════════════
// LOCAL analysis-layer structure ONLY. Not a canonical schema.
// Holds row-summaries, partial rows, evidence, confidence, coverage.
// Do not promote to CanonicalStudentFile in V1.
//
// This file represents the truthful partial state of a transcript
// after parsing. It is consumed by the engine to build proposals
// and to surface review-first artifacts.
// ═══════════════════════════════════════════════════════════════

import type { ParserType } from '../document-analysis-model';

/** A single course/subject row reconstructed from the transcript. */
export interface TranscriptRow {
  /** Best-effort raw line(s) the row was reconstructed from. */
  raw_line: string;
  /** Subject / course title (may be partial / OCR-noisy). */
  subject_raw: string | null;
  /** Course code if visible (e.g. CHEM101). */
  course_code: string | null;
  /** Grade as it appears (letter, percent, GPA point). Not normalized. */
  grade_raw: string | null;
  /** Credit hours / units if visible. */
  credits_raw: string | null;
  /** Semester / year hint if visible. */
  term_raw: string | null;
  /** 0..1 confidence in this row reconstruction. */
  confidence: number;
  /** Truthfully partial: which expected columns we did NOT find on this line. */
  missing_columns: Array<'subject' | 'grade' | 'credits' | 'term'>;
}

/** Top-level fields parsed from the transcript header / summary area. */
export interface TranscriptHeader {
  institution_name: { value: string; raw: string; confidence: number } | null;
  degree_program: { value: string; raw: string; confidence: number } | null;
  /** GPA / CGPA value as parsed (string to preserve formatting). */
  gpa_raw: { value: string; raw: string; confidence: number } | null;
  /** Detected GPA scale denominator (e.g. "4.0", "5", "100"). null if unclear. */
  gpa_scale: { value: string; raw: string; confidence: number } | null;
  /** Credit-system hint (e.g. "credit hours", "ECTS"). */
  grading_system_hint: { value: string; raw: string; confidence: number } | null;
}

/** Coverage estimate for the partial-truth contract. */
export interface TranscriptCoverage {
  /** Total non-empty lines that looked row-like. */
  candidate_lines: number;
  /** Lines we actually reconstructed into a TranscriptRow. */
  rows_reconstructed: number;
  /** rows_reconstructed / candidate_lines, clamped 0..1. 0 when no candidates. */
  coverage_estimate: number;
  /** True iff parser returned anything but cannot guarantee completeness. */
  partial: boolean;
}

/** Structured signals used by classification disambiguation (NOT tabular-only). */
export interface TranscriptDisambiguationSignals {
  /** transcript-vocabulary hits ("transcript", "academic record", "كشف درجات"). */
  vocabulary_hits: string[];
  /** GPA / CGPA / cumulative / semester signal hits. */
  gpa_signals: string[];
  /** Grade pattern hits (letter grades, X/Y, percentages near subject names). */
  grade_pattern_hits: number;
  /** Credit pattern hits (credit hours / units / ECTS). */
  credit_pattern_hits: number;
  /** Row-like line count (multi-column lines that look like course rows). */
  row_like_lines: number;
}

/** Full intermediate transcript structure produced by the parser. */
export interface TranscriptIntermediate {
  parser_source: ParserType;
  header: TranscriptHeader;
  rows: TranscriptRow[];
  coverage: TranscriptCoverage;
  signals: TranscriptDisambiguationSignals;
  /** Order-2 truthful partial flag — true unless we are certain we got everything. */
  partial: boolean;
  /** Compact evidence summary string for logs. */
  evidence_summary: string;
}

export function emptyIntermediate(parser: ParserType = 'regex_heuristic'): TranscriptIntermediate {
  return {
    parser_source: parser,
    header: {
      institution_name: null,
      degree_program: null,
      gpa_raw: null,
      gpa_scale: null,
      grading_system_hint: null,
    },
    rows: [],
    coverage: { candidate_lines: 0, rows_reconstructed: 0, coverage_estimate: 0, partial: true },
    signals: {
      vocabulary_hits: [],
      gpa_signals: [],
      grade_pattern_hits: 0,
      credit_pattern_hits: 0,
      row_like_lines: 0,
    },
    partial: true,
    evidence_summary: '',
  };
}
