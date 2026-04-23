import type { LanguageTestCefrMapping } from '../../types';

// Phase A skeleton — DRAFT bands, awaiting truth review.
export const LANGUAGE_CEFR_MAPPINGS: LanguageTestCefrMapping[] = [
  {
    mapping_id: 'IELTS_academic.en.draft',
    test_name: 'IELTS_academic',
    language_code: 'en',
    bands: [
      { score_min: 4.0, score_max: 4.5, cefr: 'B1' },
      { score_min: 5.0, score_max: 6.0, cefr: 'B2' },
      { score_min: 6.5, score_max: 7.5, cefr: 'C1' },
      { score_min: 8.0, score_max: 9.0, cefr: 'C2' },
    ],
    evidence_ids: ['language.cefr.draft.2026'],
  },
  {
    mapping_id: 'TOEFL_iBT.en.draft',
    test_name: 'TOEFL_iBT',
    language_code: 'en',
    bands: [
      { score_min: 42, score_max: 71, cefr: 'B1' },
      { score_min: 72, score_max: 94, cefr: 'B2' },
      { score_min: 95, score_max: 120, cefr: 'C1' },
    ],
    evidence_ids: ['language.cefr.draft.2026'],
  },
];
