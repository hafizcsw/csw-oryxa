import type { CountryEducationProfile } from '../../types';

// Phase A skeleton — DRAFT, awaiting truth review.
export const AE_PROFILE: CountryEducationProfile = {
  country_code: 'AE',
  country_name_en: 'United Arab Emirates',
  primary_local_language: 'ar',
  secondary_system_summary:
    'MoE secondary certificate (general/advanced/elite streams), 12-year cycle.',
  grading_scale: [
    {
      scale_id: 'AE_moe_pct_100',
      max_value: 100,
      pass_threshold_pct: 60,
      notes: 'Percentage scale, advanced/elite stream weighting — DRAFT.',
    },
  ],
  evidence_ids: ['AE.profile.draft.2026'],
};
