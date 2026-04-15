-- Remove implicit defaults from SoT fields in the v3_final search view.
-- Goal: Keep NULL as NULL (no COALESCE to false/0/'on_campus') for:
--  - study_mode
--  - has_dorm
--  - monthly_living_usd
--  - scholarship_available

CREATE OR REPLACE VIEW public.vw_program_search_api_v3_final AS
SELECT p.id AS program_id,
    u.id AS university_id,
    c.country_code,
    u.city,
    d.slug AS degree_slug,
    disc.slug AS discipline_slug,
    p.study_mode AS study_mode,
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
    u.has_dorm AS has_dorm,
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
  WHERE p.is_active = true AND p.publish_status = 'published'::text AND COALESCE(ug.do_not_offer, false) = false;
