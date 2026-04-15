-- ============================================================
-- KB Search v1.3 Final - Complete Schema + View Migration
-- ============================================================

-- 1) Add missing columns to programs table
ALTER TABLE public.programs 
  ADD COLUMN IF NOT EXISTS study_mode TEXT DEFAULT 'on_campus',
  ADD COLUMN IF NOT EXISTS foundation_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS entrance_exam_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS entrance_exam_types TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS scholarship_type TEXT DEFAULT NULL;

-- 2) Add missing columns to universities table  
ALTER TABLE public.universities
  ADD COLUMN IF NOT EXISTS partner_preferred BOOLEAN DEFAULT false;

-- 3) Create v3_final View (SoT for KB Search)
CREATE OR REPLACE VIEW public.vw_program_search_api_v3_final AS
SELECT
  -- Identity
  p.id AS program_id,
  u.id AS university_id,
  c.country_code,
  u.city,
  d.slug AS degree_slug,
  disc.slug AS discipline_slug,
  COALESCE(p.study_mode, 'on_campus') AS study_mode,
  
  -- Languages (instruction)
  (
    SELECT ARRAY_AGG(DISTINCT pl.language_code)
    FROM public.program_languages pl
    WHERE pl.program_id = p.id
  ) AS instruction_languages,
  
  -- i18n names
  jsonb_build_object(
    'ar', COALESCE(pi_ar.name, p.title),
    'en', COALESCE(pi_en.name, p.title)
  ) AS display_name_i18n,
  jsonb_build_object(
    'ar', COALESCE(ui_ar.name, u.name),
    'en', COALESCE(ui_en.name, u.name)
  ) AS university_display_name_i18n,
  
  -- Fallback display names
  COALESCE(pi_ar.name, pi_en.name, p.title) AS program_name_ar,
  COALESCE(pi_en.name, pi_ar.name, p.title) AS program_name_en,
  COALESCE(ui_ar.name, ui_en.name, u.name) AS university_name_ar,
  COALESCE(ui_en.name, ui_ar.name, u.name) AS university_name_en,
  
  -- Tuition by basis
  'year'::text AS tuition_basis,
  p.tuition_usd_min AS tuition_usd_year_min,
  p.tuition_usd_max AS tuition_usd_year_max,
  ROUND(COALESCE(p.tuition_usd_min, 0) / 2, 0) AS tuition_usd_semester_min,
  ROUND(COALESCE(p.tuition_usd_max, 0) / 2, 0) AS tuition_usd_semester_max,
  ROUND(COALESCE(p.tuition_usd_min, 0) * GREATEST(COALESCE(p.duration_months, 12) / 12.0, 1), 0) AS tuition_usd_program_total_min,
  ROUND(COALESCE(p.tuition_usd_max, 0) * GREATEST(COALESCE(p.duration_months, 12) / 12.0, 1), 0) AS tuition_usd_program_total_max,
  p.tuition_is_free,
  p.currency_code,
  
  -- Duration
  p.duration_months,
  
  -- Housing & Living
  COALESCE(u.has_dorm, false) AS has_dorm,
  u.dorm_price_monthly_local,
  u.dorm_currency_code,
  CASE 
    WHEN u.dorm_currency_code = 'USD' THEN u.dorm_price_monthly_local
    WHEN fx.rate_to_usd IS NOT NULL AND u.dorm_price_monthly_local IS NOT NULL 
    THEN ROUND(u.dorm_price_monthly_local * fx.rate_to_usd, 2)
    ELSE NULL
  END AS dorm_price_monthly_usd,
  COALESCE(u.monthly_living, 0) AS monthly_living_usd,
  
  -- Scholarship
  COALESCE(p.has_scholarship, false) AS scholarship_available,
  p.scholarship_type,
  
  -- Partner
  COALESCE(ug.csw_star, false) AS partner_star,
  ug.partner_tier,
  COALESCE(u.partner_preferred, false) AS partner_preferred,
  COALESCE(ug.priority_score, 0) AS priority_score,
  COALESCE(ug.do_not_offer, false) AS do_not_offer,
  
  -- Intake / Deadline
  p.intake_months,
  p.next_intake_date AS deadline_date,
  
  -- Program Requirements
  COALESCE(p.prep_year_required, false) AS prep_year_required,
  COALESCE(p.foundation_required, false) AS foundation_required,
  COALESCE(p.entrance_exam_required, false) AS entrance_exam_required,
  p.entrance_exam_types,
  
  -- Portal URL
  '/program/' || p.id::text AS portal_url,
  
  -- Status
  p.is_active,
  p.publish_status,
  
  -- Ranking
  u.ranking

FROM public.programs p
JOIN public.universities u ON u.id = p.university_id
JOIN public.countries c ON c.id = u.country_id
LEFT JOIN public.degrees d ON d.id = p.degree_id
LEFT JOIN public.disciplines disc ON disc.id = p.discipline_id
LEFT JOIN public.csw_university_guidance ug ON ug.university_id = u.id
LEFT JOIN public.fx_rates_latest fx ON fx.currency_code = u.dorm_currency_code
LEFT JOIN public.program_i18n pi_ar ON pi_ar.program_id = p.id AND pi_ar.lang_code = 'ar'
LEFT JOIN public.program_i18n pi_en ON pi_en.program_id = p.id AND pi_en.lang_code = 'en'
LEFT JOIN public.university_i18n ui_ar ON ui_ar.university_id = u.id AND ui_ar.lang_code = 'ar'
LEFT JOIN public.university_i18n ui_en ON ui_en.university_id = u.id AND ui_en.lang_code = 'en'
WHERE p.is_active = true 
  AND p.publish_status = 'published'
  AND COALESCE(ug.do_not_offer, false) = false;

COMMENT ON VIEW public.vw_program_search_api_v3_final IS 'KB Search SoT v1.3 Final';