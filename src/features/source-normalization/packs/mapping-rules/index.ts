import type { CredentialMappingRule } from '../../types';

// Phase A skeleton — DRAFT rules, awaiting truth review.
// Engine does NOT consume these yet — skeleton only.
export const MAPPING_RULES: CredentialMappingRule[] = [
  {
    rule_id: 'EG.rule.thanaweya_amma',
    source_country_code: 'EG',
    applies_when: {
      pattern_ids: ['EG.thanaweya_amma.ar', 'EG.thanaweya_amma.en'],
    },
    emits: {
      normalized_kind: 'secondary_general',
      normalized_subtype: 'thanaweya_amma',
      grade_normalization: {
        from_scale_id: 'EG_thanaweya_total_410',
        formula_id: 'pct_from_total',
      },
    },
    needs_manual_review_if: ['grade_unparseable', 'multiple_streams_detected'],
    priority: 100,
    evidence_ids: ['EG.rule.draft.2026'],
  },
  {
    rule_id: 'EG.rule.thanaweya_fanniya',
    source_country_code: 'EG',
    applies_when: {
      pattern_ids: ['EG.thanaweya_fanniya.ar'],
    },
    emits: {
      normalized_kind: 'secondary_technical',
      normalized_subtype: 'thanaweya_fanniya',
    },
    needs_manual_review_if: ['grade_unparseable'],
    priority: 100,
    evidence_ids: ['EG.rule.draft.2026'],
  },
  {
    rule_id: 'AE.rule.moe_secondary',
    source_country_code: 'AE',
    applies_when: {
      pattern_ids: ['AE.moe_secondary.ar', 'AE.moe_secondary.en'],
    },
    emits: {
      normalized_kind: 'secondary_general',
      normalized_subtype: 'moe_secondary',
      grade_normalization: {
        from_scale_id: 'AE_moe_pct_100',
        formula_id: 'pct_passthrough',
      },
    },
    needs_manual_review_if: ['stream_advanced_vs_elite_unclear'],
    priority: 100,
    evidence_ids: ['AE.rule.draft.2026'],
  },
  {
    rule_id: 'JO.rule.tawjihi',
    source_country_code: 'JO',
    applies_when: {
      pattern_ids: ['JO.tawjihi.ar', 'JO.tawjihi.en'],
    },
    emits: {
      normalized_kind: 'secondary_general',
      normalized_subtype: 'tawjihi',
      grade_normalization: {
        from_scale_id: 'JO_tawjihi_pct_100',
        formula_id: 'pct_passthrough',
      },
    },
    needs_manual_review_if: ['track_vocational_vs_academic_unclear'],
    priority: 100,
    evidence_ids: ['JO.rule.draft.2026'],
  },
];
