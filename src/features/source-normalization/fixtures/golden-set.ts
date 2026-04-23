// ═══════════════════════════════════════════════════════════════
// Golden Set 3×3 — DRAFT, awaiting truth review.
// 3 clear · 3 ambiguous · 3 noisy across EG, AE, JO.
// Engine is NOT yet wired to these. Review expected outputs first.
// ═══════════════════════════════════════════════════════════════

import type { NormalizerInput, NormalizerOutput } from '../types';

export interface GoldenCase {
  case_id: string;
  category: 'clear' | 'ambiguous' | 'noisy';
  notes: string;
  input: NormalizerInput;
  expected: Partial<NormalizerOutput>;
}

export const GOLDEN_SET: GoldenCase[] = [
  // ── CLEAR ───────────────────────────────────────────────────
  {
    case_id: 'EG.clear.thanaweya_amma_high',
    category: 'clear',
    notes: 'Standard EG thanaweya amma, Arabic name, total marks reported.',
    input: {
      student_user_id: 'fixture-student-eg-1',
      source_country_code: 'EG',
      award_name_raw: 'الثانوية العامة',
      award_year: 2024,
      award_score_raw: '380/410',
    },
    expected: {
      normalized_credential_kind: 'secondary_general',
      normalized_credential_subtype: 'thanaweya_amma',
      normalized_grade_pct: 92.68,
      needs_manual_review: false,
      matched_rule_ids: ['EG.rule.thanaweya_amma'],
    },
  },
  {
    case_id: 'AE.clear.moe_secondary_pct',
    category: 'clear',
    notes: 'Standard UAE MoE secondary with direct percentage.',
    input: {
      student_user_id: 'fixture-student-ae-1',
      source_country_code: 'AE',
      award_name_raw: 'الثانوية العامة',
      award_year: 2024,
      award_score_raw: '88%',
    },
    expected: {
      normalized_credential_kind: 'secondary_general',
      normalized_credential_subtype: 'moe_secondary',
      normalized_grade_pct: 88,
      needs_manual_review: false,
      matched_rule_ids: ['AE.rule.moe_secondary'],
    },
  },
  {
    case_id: 'JO.clear.tawjihi_academic',
    category: 'clear',
    notes: 'Standard JO tawjihi, English name, percentage scale.',
    input: {
      student_user_id: 'fixture-student-jo-1',
      source_country_code: 'JO',
      award_name_raw: 'Tawjihi',
      award_year: 2024,
      award_score_raw: '85.5%',
    },
    expected: {
      normalized_credential_kind: 'secondary_general',
      normalized_credential_subtype: 'tawjihi',
      normalized_grade_pct: 85.5,
      needs_manual_review: false,
      matched_rule_ids: ['JO.rule.tawjihi'],
    },
  },
  // ── AMBIGUOUS ───────────────────────────────────────────────
  {
    case_id: 'EG.ambiguous.thanaweya_no_track',
    category: 'ambiguous',
    notes: 'EG name matches but track (scientific/literary) not specified.',
    input: {
      student_user_id: 'fixture-student-eg-2',
      source_country_code: 'EG',
      award_name_raw: 'الثانوية العامة',
      award_year: 2024,
      award_score_raw: '350/410',
    },
    expected: {
      normalized_credential_kind: 'secondary_general',
      normalized_credential_subtype: 'thanaweya_amma',
      normalized_grade_pct: 85.37,
      needs_manual_review: true,
    },
  },
  {
    case_id: 'AE.ambiguous.advanced_vs_elite',
    category: 'ambiguous',
    notes: 'AE secondary but stream (advanced/elite) unclear in source.',
    input: {
      student_user_id: 'fixture-student-ae-2',
      source_country_code: 'AE',
      award_name_raw: 'UAE Secondary',
      award_year: 2024,
      award_score_raw: '92',
    },
    expected: {
      normalized_credential_kind: 'secondary_general',
      normalized_credential_subtype: 'moe_secondary',
      normalized_grade_pct: 92,
      needs_manual_review: true,
    },
  },
  {
    case_id: 'JO.ambiguous.track_unclear',
    category: 'ambiguous',
    notes: 'JO tawjihi but academic vs vocational track not stated.',
    input: {
      student_user_id: 'fixture-student-jo-2',
      source_country_code: 'JO',
      award_name_raw: 'التوجيهي',
      award_year: 2024,
      award_score_raw: '78%',
    },
    expected: {
      normalized_credential_kind: 'secondary_general',
      normalized_credential_subtype: 'tawjihi',
      normalized_grade_pct: 78,
      needs_manual_review: true,
    },
  },
  // ── NOISY ──────────────────────────────────────────────────
  {
    case_id: 'EG.noisy.unparseable_grade',
    category: 'noisy',
    notes: 'EG name OK but grade field is free text ("ممتاز").',
    input: {
      student_user_id: 'fixture-student-eg-3',
      source_country_code: 'EG',
      award_name_raw: 'الثانوية العامة',
      award_year: 2023,
      award_grade_raw: 'ممتاز',
    },
    expected: {
      normalized_credential_kind: 'secondary_general',
      normalized_credential_subtype: 'thanaweya_amma',
      normalized_grade_pct: null,
      needs_manual_review: true,
    },
  },
  {
    case_id: 'AE.noisy.unknown_award_name',
    category: 'noisy',
    notes: 'AE country but award name does not match any pattern.',
    input: {
      student_user_id: 'fixture-student-ae-3',
      source_country_code: 'AE',
      award_name_raw: 'Some Custom Diploma 2024',
      award_year: 2024,
      award_score_raw: '80%',
    },
    expected: {
      normalized_credential_kind: 'unknown',
      normalized_grade_pct: null,
      needs_manual_review: true,
    },
  },
  {
    case_id: 'JO.noisy.year_missing_grade_text',
    category: 'noisy',
    notes: 'JO tawjihi, no year, grade is descriptive text.',
    input: {
      student_user_id: 'fixture-student-jo-3',
      source_country_code: 'JO',
      award_name_raw: 'tawjihi',
      award_grade_raw: 'jayyid jiddan',
    },
    expected: {
      normalized_credential_kind: 'secondary_general',
      normalized_credential_subtype: 'tawjihi',
      normalized_grade_pct: null,
      needs_manual_review: true,
    },
  },
];
