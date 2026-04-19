// ═══════════════════════════════════════════════════════════════
// Door 2 — Canonical Lane Fact Model
// ═══════════════════════════════════════════════════════════════
// One shape ALL lanes (passport, graduation, language) emit.
// Truth-honest: every field carries its own status + confidence.
// No hallucination — missing/proposed/needs_review allowed.
// ═══════════════════════════════════════════════════════════════

export type FieldStatus = 'extracted' | 'proposed' | 'missing' | 'needs_review';

export interface CanonicalField<T = string> {
  /** The actual value, or null when missing/needs_review. */
  value: T | null;
  /** 0..1 — how confident the lane is in this specific field. */
  confidence: number;
  /** Where this field came from: 'mrz', 'pdf_text', 'ocr_tesseract', 'filename', etc. */
  source: string;
  /** Truth status — never lie. */
  status: FieldStatus;
  /** Optional raw matched substring for audit. */
  raw?: string | null;
}

export type LaneKind =
  | 'passport_lane'
  | 'graduation_lane'
  | 'language_lane';

export interface LaneEngineMetadata {
  producer: string;            // e.g. 'passport-lane-v1'
  processing_ms: number;
  ocr_used: boolean;
  pdf_text_used: boolean;
  schema_version: string;
}

export interface LaneFactsOutput {
  document_id: string;
  lane: LaneKind;
  /** Aggregate truth state — derived from per-field statuses. */
  truth_state: 'extracted' | 'proposed' | 'needs_review';
  /** Aggregate 0..1 confidence across required fields. */
  lane_confidence: number;
  /** True iff any required field is missing or low-confidence. */
  requires_review: boolean;
  /** Free-form facts dictionary keyed by canonical field name. */
  facts: Record<string, CanonicalField>;
  engine_metadata: LaneEngineMetadata;
  notes: string[];
}

/** Construct a 'missing' field cleanly. */
export function missingField(source = 'lane'): CanonicalField {
  return { value: null, confidence: 0, source, status: 'missing' };
}

/** Aggregate truth_state + requires_review from a facts dictionary
 *  given a list of REQUIRED field names. */
export function aggregateLaneTruth(
  facts: Record<string, CanonicalField>,
  required: string[],
): { truth_state: LaneFactsOutput['truth_state']; lane_confidence: number; requires_review: boolean } {
  const requiredFields = required.map((k) => facts[k]).filter(Boolean);
  if (requiredFields.length === 0) {
    return { truth_state: 'needs_review', lane_confidence: 0, requires_review: true };
  }

  const anyMissing = requiredFields.some((f) => f.status === 'missing');
  const anyNeedsReview = requiredFields.some((f) => f.status === 'needs_review');
  const allExtracted = requiredFields.every((f) => f.status === 'extracted');

  const avg =
    requiredFields.reduce((s, f) => s + (f.confidence ?? 0), 0) / requiredFields.length;
  const lane_confidence = Number(avg.toFixed(3));

  if (anyMissing || anyNeedsReview || lane_confidence < 0.55) {
    return { truth_state: 'needs_review', lane_confidence, requires_review: true };
  }
  if (allExtracted && lane_confidence >= 0.75) {
    return { truth_state: 'extracted', lane_confidence, requires_review: false };
  }
  return { truth_state: 'proposed', lane_confidence, requires_review: lane_confidence < 0.7 };
}
