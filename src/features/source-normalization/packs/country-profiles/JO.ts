import type { CountryEducationProfile } from '../../types';

// Phase A skeleton — DRAFT, awaiting truth review.
export const JO_PROFILE: CountryEducationProfile = {
  country_code: 'JO',
  country_name_en: 'Jordan',
  primary_local_language: 'ar',
  secondary_system_summary:
    'Tawjihi (General Secondary Education Certificate Examination), academic/vocational tracks.',
  grading_scale: [
    {
      scale_id: 'JO_tawjihi_pct_100',
      max_value: 100,
      pass_threshold_pct: 50,
      notes: 'Percentage scale; track weighting varies — DRAFT.',
    },
  ],
  evidence_ids: ['JO.profile.draft.2026'],
};
