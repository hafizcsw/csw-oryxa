-- ============= Phase 1: Add missing columns to vw_program_search_api_v3_final =============
-- This migration adds: university_logo, country_name_ar/en, degree_name, discipline_name_ar/en
-- Required for ProgramCard UI compatibility

DROP VIEW IF EXISTS public.vw_program_search_api_v3_final;

CREATE OR REPLACE VIEW public.vw_program_search_api_v3_final AS
SELECT 
  p.id AS program_id,
  u.id AS university_id,
  c.country_code,
  u.city,
  d.slug AS degree_slug,
  disc.slug AS discipline_slug,
  COALESCE(p.study_mode, 'on_campus'::text) AS study_mode,
  (SELECT array_agg(DISTINCT pl.language_code) 
   FROM program_languages pl 
   WHERE pl.program_id = p.id) AS instruction_languages,
  
  -- i18n display objects
  jsonb_build_object('ar', COALESCE(pi_ar.name, p.title), 'en', COALESCE(pi_en.name, p.title)) AS display_name_i18n,
  jsonb_build_object('ar', COALESCE(ui_ar.name, u.name), 'en', COALESCE(ui_en.name, u.name)) AS university_display_name_i18n,
  
  -- Program names
  COALESCE(pi_ar.name, pi_en.name, p.title) AS program_name_ar,
  COALESCE(pi_en.name, pi_ar.name, p.title) AS program_name_en,
  
  -- University names & logo
  COALESCE(ui_ar.name, ui_en.name, u.name) AS university_name_ar,
  COALESCE(ui_en.name, ui_ar.name, u.name) AS university_name_en,
  u.logo_url AS university_logo,  -- ✅ ADDED
  
  -- Country names
  c.name_ar AS country_name_ar,   -- ✅ ADDED
  c.name_en AS country_name_en,   -- ✅ ADDED
  
  -- Degree names
  d.name AS degree_name,          -- ✅ ADDED
  
  -- Discipline names
  disc.name_ar AS discipline_name_ar,  -- ✅ ADDED
  disc.name_en AS discipline_name_en,  -- ✅ ADDED
  
  -- Tuition (basis defaults to 'year')
  'year'::text AS tuition_basis,
  p.tuition_usd_min AS tuition_usd_year_min,
  p.tuition_usd_max AS tuition_usd_year_max,
  round(COALESCE(p.tuition_usd_min, 0::numeric) / 2::numeric, 0) AS tuition_usd_semester_min,
  round(COALESCE(p.tuition_usd_max, 0::numeric) / 2::numeric, 0) AS tuition_usd_semester_max,
  round(COALESCE(p.tuition_usd_min, 0::numeric) * GREATEST(COALESCE(p.duration_months, 12)::numeric / 12.0, 1::numeric), 0) AS tuition_usd_program_total_min,
  round(COALESCE(p.tuition_usd_max, 0::numeric) * GREATEST(COALESCE(p.duration_months, 12)::numeric / 12.0, 1::numeric), 0) AS tuition_usd_program_total_max,
  p.tuition_is_free,
  p.currency_code,
  p.duration_months,
  
  -- Housing
  COALESCE(u.has_dorm, false) AS has_dorm,
  u.dorm_price_monthly_local,
  u.dorm_currency_code,
  CASE
    WHEN u.dorm_currency_code = 'USD'::text THEN u.dorm_price_monthly_local
    WHEN fx.rate_to_usd IS NOT NULL AND u.dorm_price_monthly_local IS NOT NULL 
      THEN round(u.dorm_price_monthly_local * fx.rate_to_usd, 2)
    ELSE NULL::numeric
  END AS dorm_price_monthly_usd,
  COALESCE(u.monthly_living, 0::numeric) AS monthly_living_usd,
  
  -- Scholarship
  COALESCE(p.has_scholarship, false) AS scholarship_available,
  p.scholarship_type,
  
  -- Partner metadata
  COALESCE(ug.csw_star, false) AS partner_star,
  ug.partner_tier,
  COALESCE(u.partner_preferred, false) AS partner_preferred,
  COALESCE(ug.priority_score, 0) AS priority_score,
  COALESCE(ug.do_not_offer, false) AS do_not_offer,
  
  -- Intake & deadlines
  p.intake_months,
  p.next_intake_date AS deadline_date,
  
  -- Requirements
  COALESCE(p.prep_year_required, false) AS prep_year_required,
  COALESCE(p.foundation_required, false) AS foundation_required,
  COALESCE(p.entrance_exam_required, false) AS entrance_exam_required,
  p.entrance_exam_types,
  
  -- Portal URL & status
  '/program/'::text || p.id::text AS portal_url,
  p.is_active,
  p.publish_status,
  u.ranking

FROM programs p
JOIN universities u ON u.id = p.university_id
JOIN countries c ON c.id = u.country_id
LEFT JOIN degrees d ON d.id = p.degree_id
LEFT JOIN disciplines disc ON disc.id = p.discipline_id
LEFT JOIN csw_university_guidance ug ON ug.university_id = u.id
LEFT JOIN fx_rates_latest fx ON fx.currency_code = u.dorm_currency_code
LEFT JOIN program_i18n pi_ar ON pi_ar.program_id = p.id AND pi_ar.lang_code = 'ar'::text
LEFT JOIN program_i18n pi_en ON pi_en.program_id = p.id AND pi_en.lang_code = 'en'::text
LEFT JOIN university_i18n ui_ar ON ui_ar.university_id = u.id AND ui_ar.lang_code = 'ar'::text
LEFT JOIN university_i18n ui_en ON ui_en.university_id = u.id AND ui_en.lang_code = 'en'::text
WHERE p.is_active = true 
  AND p.publish_status = 'published'::text 
  AND COALESCE(ug.do_not_offer, false) = false;

-- Grant permissions
GRANT SELECT ON public.vw_program_search_api_v3_final TO anon, authenticated, service_role;