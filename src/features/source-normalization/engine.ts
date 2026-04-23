// ═══════════════════════════════════════════════════════════════
// Source-Side Normalization Engine — SKELETON ONLY
// ═══════════════════════════════════════════════════════════════
// Phase A: contract is fixed. Logic is NOT implemented yet.
// Implementation gated on: golden-set fixtures reviewed + accepted.
// ═══════════════════════════════════════════════════════════════

import type {
  NormalizerInput,
  NormalizerOutput,
  SourceNormalizer,
} from './types';

export const NORMALIZER_VERSION = 'phase-a.skeleton.0.1';

class SkeletonNormalizer implements SourceNormalizer {
  version = NORMALIZER_VERSION;

  normalize(input: NormalizerInput): NormalizerOutput {
    // Skeleton: returns "unknown" with manual review flag.
    // Real logic will land after golden-set fixtures are accepted.
    return {
      student_user_id: input.student_user_id,
      source_country_code: input.source_country_code,
      normalized_credential_kind: 'unknown',
      normalized_credential_subtype: undefined,
      normalized_grade_pct: null,
      normalized_cefr_level: null,
      normalized_language_code: null,
      confidence: 0,
      needs_manual_review: true,
      matched_rule_ids: [],
      evidence_ids: [],
      decisions: [
        {
          decision_kind: 'review_flag',
          reason_code: 'manual_review_required',
          params: { reason: 'engine_skeleton_only' },
          evidence_ids: [],
        },
      ],
      normalizer_version: this.version,
      trace_id: input.trace_id,
    };
  }
}

export const sourceNormalizer: SourceNormalizer = new SkeletonNormalizer();
