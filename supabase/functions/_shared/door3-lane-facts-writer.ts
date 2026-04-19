// ═══════════════════════════════════════════════════════════════
// Door 3 — Lane Facts Writer (edge-safe, mirrors Door 2 contract)
// ═══════════════════════════════════════════════════════════════
// - Upserts on document_id (current PK; NOT (document_id, lane))
// - Self-contained aggregation (no frontend imports)
// - decided_by='engine' is recorded inside engine_metadata
// ═══════════════════════════════════════════════════════════════

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export type FieldStatus = 'extracted' | 'proposed' | 'missing' | 'needs_review';

export interface CanonicalField<T = string> {
  value: T | null;
  confidence: number;
  source: string;
  status: FieldStatus;
  raw?: string | null;
}

export type LaneKind = 'passport_lane' | 'graduation_lane' | 'language_lane';

export function missingField(source = 'door3'): CanonicalField {
  return { value: null, confidence: 0, source, status: 'missing' };
}

/** Edge-safe mirror of src/features/documents/lanes/lane-fact-model.ts#aggregateLaneTruth */
export function aggregateLaneTruth(
  facts: Record<string, CanonicalField>,
  required: string[],
): { truth_state: 'extracted' | 'proposed' | 'needs_review'; lane_confidence: number; requires_review: boolean } {
  const req = required.map((k) => facts[k]).filter(Boolean);
  if (req.length === 0) return { truth_state: 'needs_review', lane_confidence: 0, requires_review: true };

  const anyMissing = req.some((f) => f.status === 'missing');
  const anyNeedsReview = req.some((f) => f.status === 'needs_review');
  const allExtracted = req.every((f) => f.status === 'extracted');
  const avg = req.reduce((s, f) => s + (f.confidence ?? 0), 0) / req.length;
  const lane_confidence = Number(avg.toFixed(3));

  if (anyMissing || anyNeedsReview || lane_confidence < 0.55) {
    return { truth_state: 'needs_review', lane_confidence, requires_review: true };
  }
  if (allExtracted && lane_confidence >= 0.75) {
    return { truth_state: 'extracted', lane_confidence, requires_review: false };
  }
  return { truth_state: 'proposed', lane_confidence, requires_review: lane_confidence < 0.7 };
}

export interface UpsertLaneFactsInput {
  admin: SupabaseClient;
  document_id: string;
  user_id: string;
  lane: LaneKind;
  facts: Record<string, CanonicalField>;
  required: string[];
  producer: string;
  processing_ms: number;
  notes: string[];
  /** machine-readable reason; persisted inside engine_metadata + notes */
  review_reason?: string | null;
}

export async function upsertLaneFacts(input: UpsertLaneFactsInput): Promise<{
  truth_state: string; lane_confidence: number; requires_review: boolean;
}> {
  const agg = aggregateLaneTruth(input.facts, input.required);
  const engine_metadata = {
    producer: input.producer,
    processing_ms: input.processing_ms,
    ocr_used: true,           // Door 3 always reads from OCR evidence
    pdf_text_used: false,
    schema_version: 'door3.v1',
    decided_by: 'engine',
    review_reason: input.review_reason ?? null,
  };
  const notes = input.review_reason
    ? [...input.notes, `review_reason:${input.review_reason}`]
    : input.notes;

  // PK is document_id only — single row per document across lanes.
  // We tag the lane inside the row; if a different lane already wrote, we overwrite truthfully.
  const { error } = await input.admin.from('document_lane_facts').upsert(
    {
      document_id: input.document_id,
      user_id: input.user_id,
      lane: input.lane,
      truth_state: agg.truth_state,
      lane_confidence: agg.lane_confidence,
      requires_review: agg.requires_review,
      facts: input.facts,
      engine_metadata,
      notes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'document_id' },
  );
  if (error) throw new Error(`lane_facts_upsert_failed:${error.message}`);
  return agg;
}
