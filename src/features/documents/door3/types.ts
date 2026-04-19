// ═══════════════════════════════════════════════════════════════
// Door 3 — Client types (mirror of supabase/functions/_shared/door3-types.ts)
// ═══════════════════════════════════════════════════════════════
// Keep these in sync. Pure types only (no runtime).
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

export type Door3ReviewState =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'keep_needs_review';

export interface Door3Job {
  id: string;
  document_id: string;
  user_id: string;
  job_type: Door3JobType;
  status: Door3JobStatus;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Door3AcademicRow {
  id: string;
  document_id: string;
  user_id: string;
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

export interface Door3AcademicSummary {
  id: string;
  document_id: string;
  user_id: string;
  metric_type: string;
  raw_label: string | null;
  normalized_label: string | null;
  raw_value: string | null;
  normalized_numeric_value: number | null;
  confidence: number;
  provenance: Record<string, unknown>;
}

export interface Door3ReviewItem {
  id: string;
  document_id: string;
  user_id: string;
  lane: string;
  reason: string;
  evidence_summary: Record<string, unknown>;
  confidence_summary: Record<string, unknown>;
  state: Door3ReviewState;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}
