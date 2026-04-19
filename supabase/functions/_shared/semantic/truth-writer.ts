// ═══════════════════════════════════════════════════════════════
// Door 3 Semantic Layer — truth writer
// ═══════════════════════════════════════════════════════════════
// Writes ONLY to:
//   - document_lane_facts  (via existing Door 3 writer)
//   - document_academic_rows
//   - document_academic_summary
//   - document_semantic_runs (audit, this layer)
// No other surfaces. No legacy tables.
// ═══════════════════════════════════════════════════════════════

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { upsertLaneFacts, type LaneKind, type CanonicalField } from '../door3-lane-facts-writer.ts';

export interface SemanticRunRow {
  document_id: string;
  user_id: string;
  evidence_version: string;
  lane: string;
  model: string;
  parser_version: string;
  outcome:
    | 'parsed'
    | 'ocr_evidence_insufficient'
    | 'parse_failed'
    | 'validator_rejected'
    | 'qwen_unconfigured'
    | 'qwen_unreachable';
  raw_ai_output: unknown | null;
  validated_facts: unknown | null;
  notes: string[];
  reason: string | null;
  processing_ms: number;
}

export async function writeSemanticRun(admin: SupabaseClient, row: SemanticRunRow): Promise<void> {
  const { error } = await admin.from('document_semantic_runs').upsert(
    { ...row, raw_ai_output: row.raw_ai_output ?? null, validated_facts: row.validated_facts ?? null },
    { onConflict: 'document_id,evidence_version' },
  );
  if (error) throw new Error(`semantic_run_upsert_failed:${error.message}`);
}

export async function writeLaneFactsFromSemantic(input: {
  admin: SupabaseClient;
  document_id: string;
  user_id: string;
  lane: LaneKind;
  facts: Record<string, CanonicalField>;
  required: string[];
  model: string;
  parser_version: string;
  processing_ms: number;
  notes: string[];
  review_reason?: string | null;
}) {
  return upsertLaneFacts({
    admin: input.admin,
    document_id: input.document_id,
    user_id: input.user_id,
    lane: input.lane,
    facts: input.facts,
    required: input.required,
    producer: `${input.parser_version}:${input.model}`,
    processing_ms: input.processing_ms,
    notes: input.notes,
    review_reason: input.review_reason ?? null,
  });
}

export interface AcademicRowInput {
  subject_name_raw: string;
  mark_raw: string | null;
  mark_numeric: number | null;
  credit_hours_raw: string | null;
  credit_hours_numeric: number | null;
  grade_raw: string | null;
  academic_period: string | null;
  row_confidence: number;
}

export async function replaceAcademicRows(
  admin: SupabaseClient,
  document_id: string,
  user_id: string,
  rows: AcademicRowInput[],
  provenance: Record<string, unknown>,
): Promise<void> {
  // Replace strategy: delete existing rows for this document, insert fresh.
  const del = await admin.from('document_academic_rows').delete().eq('document_id', document_id);
  if (del.error) throw new Error(`academic_rows_delete_failed:${del.error.message}`);
  if (rows.length === 0) return;
  const payload = rows.map((r) => ({
    document_id,
    user_id,
    academic_period: r.academic_period,
    subject_name_raw: r.subject_name_raw,
    subject_name_normalized: null,
    mark_raw: r.mark_raw,
    mark_numeric: r.mark_numeric,
    credit_hours_raw: r.credit_hours_raw,
    credit_hours_numeric: r.credit_hours_numeric,
    grade_raw: r.grade_raw,
    row_confidence: r.row_confidence,
    provenance,
  }));
  const { error } = await admin.from('document_academic_rows').insert(payload);
  if (error) throw new Error(`academic_rows_insert_failed:${error.message}`);
}

export interface AcademicSummaryInput {
  metric_type: string;
  raw_label: string | null;
  raw_value: string | null;
  normalized_numeric_value: number | null;
  confidence: number;
}

export async function replaceAcademicSummary(
  admin: SupabaseClient,
  document_id: string,
  user_id: string,
  metrics: AcademicSummaryInput[],
  provenance: Record<string, unknown>,
): Promise<void> {
  const del = await admin.from('document_academic_summary').delete().eq('document_id', document_id);
  if (del.error) throw new Error(`academic_summary_delete_failed:${del.error.message}`);
  if (metrics.length === 0) return;
  const payload = metrics.map((m) => ({
    document_id,
    user_id,
    metric_type: m.metric_type,
    raw_label: m.raw_label,
    normalized_label: null,
    raw_value: m.raw_value,
    normalized_numeric_value: m.normalized_numeric_value,
    confidence: m.confidence,
    provenance,
  }));
  const { error } = await admin.from('document_academic_summary').insert(payload);
  if (error) throw new Error(`academic_summary_insert_failed:${error.message}`);
}
