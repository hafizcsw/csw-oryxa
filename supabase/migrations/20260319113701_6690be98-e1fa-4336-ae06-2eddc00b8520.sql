-- Truth-surface pass: block university/program level mixing, wire new columns

-- 1. vw_program_search_api_v3_final: append new program-level columns (no column reorder needed)
CREATE OR REPLACE VIEW public.vw_program_search_api_v3_final AS
SELECT p.id AS program_id,
    u.id AS university_id,
    c.country_code,
    u.city,
    d.slug AS degree_slug,
    disc.slug AS discipline_slug,
    p.study_mode,
    ( SELECT array_agg(DISTINCT pl.language_code) AS array_agg
           FROM program_languages pl
          WHERE pl.program_id = p.id) AS instruction_languages,
    jsonb_build_object('ar', COALESCE(pi_ar.name, p.title), 'en', COALESCE(pi_en.name, p.title)) AS display_name_i18n,
    jsonb_build_object('ar', COALESCE(ui_ar.name, u.name), 'en', COALESCE(ui_en.name, u.name)) AS university_display_name_i18n,
    COALESCE(pi_ar.name, pi_en.name, p.title) AS program_name_ar,
    COALESCE(pi_en.name, pi_ar.name, p.title) AS program_name_en,
    COALESCE(ui_ar.name, ui_en.name, u.name) AS university_name_ar,
    COALESCE(ui_en.name, ui_ar.name, u.name) AS university_name_en,
    u.logo_url AS university_logo,
    c.name_ar AS country_name_ar,
    c.name_en AS country_name_en,
    d.name AS degree_name,
    disc.name_ar AS discipline_name_ar,
    disc.name_en AS discipline_name_en,
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
    u.has_dorm,
    u.dorm_price_monthly_local,
    u.dorm_currency_code,
        CASE
            WHEN u.dorm_currency_code = 'USD'::text THEN u.dorm_price_monthly_local
            WHEN fx.rate_to_usd IS NOT NULL AND u.dorm_price_monthly_local IS NOT NULL THEN round(u.dorm_price_monthly_local * fx.rate_to_usd, 2)
            ELSE NULL::numeric
        END AS dorm_price_monthly_usd,
    u.monthly_living AS monthly_living_usd,
    p.has_scholarship AS scholarship_available,
    p.scholarship_type,
    COALESCE(ug.csw_star, false) AS partner_star,
    ug.partner_tier,
    COALESCE(u.partner_preferred, false) AS partner_preferred,
    COALESCE(ug.priority_score, 0) AS priority_score,
    COALESCE(ug.do_not_offer, false) AS do_not_offer,
    p.intake_months,
    p.next_intake_date AS deadline_date,
    COALESCE(p.prep_year_required, false) AS prep_year_required,
    COALESCE(p.foundation_required, false) AS foundation_required,
    COALESCE(p.entrance_exam_required, false) AS entrance_exam_required,
    p.entrance_exam_types,
    '/program/'::text || p.id::text AS portal_url,
    p.is_active,
    p.publish_status,
    u.ranking,
    ir.ranking_system,
    ir.ranking_year,
    ir.world_rank,
    ir.national_rank,
    ir.overall_score,
    ir.teaching_score,
    ir.employability_score,
    ir.academic_reputation_score,
    ir.research_score,
    -- NEW: program-level fields (strictly from programs, no university fallback)
    p.apply_url,
    p.ielts_required,
    p.duolingo_min,
    p.pte_min,
    p.cefr_level
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
     LEFT JOIN institution_rankings ir ON ir.institution_id = u.id AND ir.is_primary = true
  WHERE p.is_active = true AND p.publish_status = 'published'::text AND COALESCE(ug.do_not_offer, false) = false;

-- 2. vw_program_details: DROP + CREATE to fix column order (no dependents)
DROP VIEW IF EXISTS public.vw_program_details;
CREATE VIEW public.vw_program_details AS
SELECT p.id AS program_id,
    p.title AS program_name,
    p.title_ar AS program_name_ar,
    p.title AS program_name_en,
    p.duration_months,
    p.ielts_required,
    p.duolingo_min,
    p.pte_min,
    p.cefr_level,
    p.apply_url,
    p.next_intake_date,
    p.next_intake,
    p.description,
    p.languages,
    p.accepted_certificates,
    p.degree_id,
    d.name AS degree_name,
    d.name_ar AS degree_name_ar,
    d.name AS degree_name_en,
    d.slug AS degree_slug,
    u.id AS university_id,
    u.name AS university_name,
    u.name_ar AS university_name_ar,
    u.name_en AS university_name_en,
    u.city,
    u.logo_url,
    u.ranking,
    -- FIXED: program-level tuition only (was u.annual_fees leaking uni-level)
    p.tuition_usd_min,
    p.tuition_usd_max,
    p.tuition_basis,
    p.currency_code AS program_currency,
    -- University living cost correctly labeled as university-level
    u.monthly_living AS university_monthly_living,
    c.id AS country_id,
    c.name_ar AS country_name,
    c.name_ar AS country_name_ar,
    c.name_en AS country_name_en,
    c.slug AS country_slug,
    c.currency_code
   FROM programs p
     JOIN universities u ON u.id = p.university_id
     JOIN countries c ON c.id = u.country_id
     LEFT JOIN degrees d ON d.id = p.degree_id
  WHERE COALESCE(p.is_active, true) AND COALESCE(u.is_active, true);

-- 3. vw_program_search: DROP + CREATE to fix column order (no dependents)
DROP VIEW IF EXISTS public.vw_program_search;
CREATE VIEW public.vw_program_search AS
SELECT p.id AS program_id,
    p.title AS program_name,
    p.description,
    p.duration_months,
    p.ielts_required,
    p.duolingo_min,
    p.pte_min,
    p.cefr_level,
    p.apply_url,
    p.languages,
    p.next_intake,
    p.next_intake_date,
    p.accepted_certificates,
    u.id AS university_id,
    u.name AS university_name,
    u.city,
    u.logo_url,
    u.main_image_url,
    -- FIXED: program-level tuition only (was u.annual_fees)
    p.tuition_usd_min,
    p.tuition_usd_max,
    p.tuition_basis,
    p.currency_code AS program_currency,
    u.monthly_living AS university_monthly_living,
    u.ranking,
    c.id AS country_id,
    c.slug AS country_slug,
    c.name_ar AS country_name,
    c.currency_code,
    p.degree_id,
    d.name AS degree_name,
    d.slug AS degree_slug
   FROM programs p
     JOIN universities u ON u.id = p.university_id
     JOIN countries c ON c.id = u.country_id
     LEFT JOIN degrees d ON d.id = p.degree_id
  WHERE COALESCE(p.is_active, true) = true AND COALESCE(u.is_active, true) = true;

-- 4. vw_university_details: DROP + CREATE to add new columns and remove ielts leak
DROP VIEW IF EXISTS public.vw_university_details;
CREATE VIEW public.vw_university_details AS
SELECT u.id AS university_id,
    u.name AS university_name,
    u.name_en AS university_name_en,
    u.name_ar AS university_name_ar,
    u.city,
    u.logo_url,
    u.hero_image_url,
    u.main_image_url,
    u.ranking,
    u.annual_fees,
    u.monthly_living,
    u.description,
    u.description_ar,
    u.has_dorm,
    u.dorm_price_monthly_local,
    u.university_type,
    u.acceptance_rate,
    u.enrolled_students,
    u.founded_year,
    u.student_count,
    u.intl_student_count,
    u.faculty_count,
    u.address,
    u.rector_name,
    u.rector_title,
    u.rector_image_url,
    u.rector_message,
    COALESCE(u.qs_world_rank, qs.world_rank) AS qs_world_rank,
    qs.national_rank AS qs_national_rank,
    ur.world_rank AS uniranks_national_rank,
    u.uniranks_rank,
    u.qs_overall_score,
    u.qs_ranking_year,
    u.qs_indicators,
    u.qs_subject_rankings,
    u.about_text,
    u.institution_type,
    u.social_links,
    u.website,
    c.id AS country_id,
    c.name_ar AS country_name,
    c.slug AS country_slug,
    c.currency_code,
    count(p.id) AS programs_count,
    -- BLOCKED: was min(p.ielts_required) leaking program-level into uni view
    -- Each program has its own ielts requirement; university does not
    min(p.next_intake_date) AS next_program_intake
   FROM universities u
     JOIN countries c ON c.id = u.country_id
     LEFT JOIN programs p ON p.university_id = u.id AND COALESCE(p.is_active, true) = true
     LEFT JOIN institution_rankings qs ON qs.institution_id = u.id AND qs.ranking_system = 'qs'::text
     LEFT JOIN institution_rankings ur ON ur.institution_id = u.id AND ur.ranking_system = 'uniranks'::text AND ur.is_primary = true
  GROUP BY u.id, c.id, qs.world_rank, qs.national_rank, ur.world_rank;