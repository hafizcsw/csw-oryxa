-- Fix: Populate `language` column from program_languages join table
-- This ensures the KB search works correctly with language filters

CREATE OR REPLACE VIEW public.vw_program_search_api AS
SELECT 
    p.id AS program_id,
    p.title AS program_name_ar,
    p.title AS program_name_en,
    p.description,
    u.id AS university_id,
    u.name AS university_name_ar,
    u.name AS university_name_en,
    u.logo_url AS university_logo,
    c.id AS country_id,
    c.country_code,
    c.name_ar AS country_name_ar,
    c.name_en AS country_name_en,
    u.city,
    deg.slug AS degree_slug,
    deg.name AS degree_name,
    disc.slug AS discipline_slug,
    disc.name_ar AS discipline_name_ar,
    disc.name_en AS discipline_name_en,
    disc.aliases_ar AS discipline_aliases_ar,
    disc.aliases_en AS discipline_aliases_en,
    -- FIX: Get primary language from program_languages, fallback to legacy column
    COALESCE(
        (SELECT pl.language_code FROM program_languages pl WHERE pl.program_id = p.id LIMIT 1),
        p.language
    ) AS language,
    -- Languages array (already correct)
    COALESCE(
        (SELECT array_agg(pl.language_code) FROM program_languages pl WHERE pl.program_id = p.id),
        CASE WHEN p.language IS NOT NULL THEN ARRAY[p.language] ELSE ARRAY[]::text[] END
    ) AS languages,
    -- Tuition USD calculations
    CASE
        WHEN COALESCE(p.tuition_is_free, false) THEN 0::numeric
        WHEN upper(COALESCE(p.currency_code, 'USD')) = 'USD' THEN COALESCE(p.tuition_local_min, p.tuition_usd_min)
        ELSE round(COALESCE(p.tuition_local_min, 0::numeric) / COALESCE(fx.rate_to_usd, 1::numeric))
    END AS tuition_usd_min,
    CASE
        WHEN COALESCE(p.tuition_is_free, false) THEN 0::numeric
        WHEN upper(COALESCE(p.currency_code, 'USD')) = 'USD' THEN COALESCE(p.tuition_local_max, p.tuition_usd_max)
        ELSE round(COALESCE(p.tuition_local_max, 0::numeric) / COALESCE(fx.rate_to_usd, 1::numeric))
    END AS tuition_usd_max,
    p.currency_code,
    p.tuition_local_min AS tuition_local_amount,
    COALESCE(p.tuition_is_free, false) AS tuition_is_free,
    u.ranking,
    p.duration_months,
    concat('/programs/', p.program_slug) AS portal_url,
    COALESCE(p.is_active, true) AS is_active,
    COALESCE(p.publish_status, 'draft') AS publish_status,
    u.monthly_living AS university_monthly_living
FROM programs p
JOIN universities u ON u.id = p.university_id
JOIN countries c ON c.id = u.country_id
LEFT JOIN degrees deg ON deg.id = p.degree_id
LEFT JOIN disciplines disc ON disc.id = p.discipline_id
LEFT JOIN fx_rates fx ON upper(fx.currency_code) = upper(p.currency_code)
WHERE p.university_id IS NOT NULL 
  AND u.country_id IS NOT NULL;