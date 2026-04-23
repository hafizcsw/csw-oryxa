import type { CountryEducationProfile } from '../../types';

// Phase A skeleton — DRAFT, awaiting truth review.
export const EG_PROFILE: CountryEducationProfile = {
  country_code: 'EG',
  country_name_en: 'Egypt',
  primary_local_language: 'ar',
  secondary_system_summary:
    'Thanaweya Amma (general), thanaweya fanniya (technical), 3-year cycle.',
  grading_scale: [
    {
      scale_id: 'EG_thanaweya_total_410',
      max_value: 410,
      pass_threshold_pct: 50,
      notes: 'Total marks scale; varies by track/year — DRAFT.',
    },
  ],
  evidence_ids: ['EG.profile.draft.2026'],
};
