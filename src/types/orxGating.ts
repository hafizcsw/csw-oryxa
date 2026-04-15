/**
 * ORX Launch Gating — Internal readiness gates contract.
 *
 * Defines the gate model that determines when an entity
 * can have internal scores, be rank-eligible, or be
 * exposed publicly.
 *
 * All gates are internal-only until calibration_passed
 * is manually approved.
 */

export interface OrxGatingStatus {
  entity_id: string;
  entity_type: string;
  gates: {
    /** Methodology version matches current spec */
    methodology_defined: boolean;
    /** Entity has a 'scored' status with non-null score */
    score_generated: boolean;
    /** Entity has been assigned a global rank */
    rank_eligible: boolean;
    /** Manual gate: calibration review passed */
    calibration_passed: boolean;
    /** Blocked from public exposure until all gates pass */
    launch_blocked: boolean;
  };
  blocking_reasons: string[];
}

export interface OrxCompositeResult {
  composite_score: number;
  composite_confidence: number;
  composite_status: 'scored' | 'evaluating' | 'insufficient';
  layers: {
    country: { score: number; source: 'computed' | 'fallback'; confidence: number };
    university: { score: number; source: 'computed' | 'fallback'; confidence: number };
    program: { score: number; source: 'computed' | 'fallback'; confidence: number };
  };
  missing_layers: string[];
  badges: string[];
}

/**
 * Composite score formula (Methodology v1.1):
 *
 * ORX = C × 0.20 + U × 0.35 + P × 0.45
 *
 * Missing-layer rules:
 * - Country missing  → fallback 50 (neutral), confidence penalty 20%
 * - University missing → fallback 0 (no credit), confidence penalty 20%
 * - Program missing   → fallback 0 (no credit), confidence penalty 20%
 *
 * Status rules:
 * - scored: ≥2 computed layers + composite confidence ≥ 30
 * - insufficient: 0 computed layers
 * - evaluating: everything else
 *
 * Rank rules:
 * - Only 'scored' entities are ranked
 * - Order: score DESC, confidence DESC (tie-break)
 * - Dense ranking: same score+confidence = same rank
 * - Deterministic: rerun produces identical output
 */
export const ORX_COMPOSITE_FORMULA = 'C * 0.20 + U * 0.35 + P * 0.45';

export const ORX_MISSING_LAYER_RULES = {
  country:    { fallback: 50, confidence_penalty: 0.20, reason: 'neutral_default' },
  university: { fallback: 0,  confidence_penalty: 0.20, reason: 'no_evidence' },
  program:    { fallback: 0,  confidence_penalty: 0.20, reason: 'no_evidence' },
} as const;

export const ORX_RANK_RULES = {
  eligibility: 'scored_only',
  order: ['score DESC', 'confidence DESC'],
  tie_handling: 'dense_rank',
  deterministic: true,
} as const;
