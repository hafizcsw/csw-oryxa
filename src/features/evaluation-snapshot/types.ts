// ═══════════════════════════════════════════════════════════════
// Student Evaluation Snapshot — Phase A persistence types
// ───────────────────────────────────────────────────────────────
// Aggregates per-document normalized credentials into a single
// student-level snapshot. Persisted in Supabase so nothing is lost
// when the student leaves the page. Recomputed ONLY when:
//   • a document is added / removed / replaced
//   • the rules_version is bumped
// ═══════════════════════════════════════════════════════════════

import type {
  NormalizerOutput,
  NormalizerReasonCode,
  SourceCountryCode,
} from '@/features/source-normalization/types';

/** A single normalized credential as persisted (one row per document). */
export interface PersistedNormalizedCredential {
  document_id: string;
  source_country: SourceCountryCode | null;
  normalized_credential_kind: NormalizerOutput['normalized_credential_kind'];
  normalized_credential_subtype?: string;
  normalized_grade_pct: number | null;
  award_year: number | null;
  matched_rule_ids: string[];
  decisions: NormalizerOutput['decisions'];
  needs_manual_review: boolean;
  rules_version: string;
  content_hash: string | null;
  raw_input?: unknown;
  raw_output?: unknown;
  updated_at?: string;
}

/** Aggregated snapshot result (the body of `result` JSONB). */
export interface EvaluationSnapshotResult {
  documents_evaluated: number;
  documents_passing: number;
  documents_needing_review: number;
  per_document: Array<{
    document_id: string;
    summary: string;
    needs_manual_review: boolean;
    reason_codes: NormalizerReasonCode[];
  }>;
  // Highest-confidence credential picked as the student's headline academic record.
  headline_credential: {
    document_id: string;
    kind: NormalizerOutput['normalized_credential_kind'];
    subtype?: string;
    grade_pct: number | null;
    source_country: SourceCountryCode | null;
  } | null;
}

/** Whole-student snapshot row as persisted. */
export interface PersistedEvaluationSnapshot {
  user_id: string;
  input_hash: string;
  rules_version: string;
  document_ids: string[];
  result: EvaluationSnapshotResult;
  needs_manual_review: boolean;
  last_computed_at: string;
  recompute_reason: string | null;
}

export type RecomputeReason =
  | 'first_compute'
  | 'document_added'
  | 'document_removed'
  | 'document_replaced'
  | 'rules_version_bump'
  | 'manual';
