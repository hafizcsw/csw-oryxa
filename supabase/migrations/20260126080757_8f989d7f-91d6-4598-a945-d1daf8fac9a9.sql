-- Drop and recreate vw_program_search_api with CORRECT FX conversion
-- Keeping exact same column order/names as current view

DROP VIEW IF EXISTS public.vw_program_search_api CASCADE;

CREATE VIEW public.vw_program_search_api AS
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
  -- Language from join table (first one as primary)
  COALESCE(
    (SELECT pl.language_code FROM public.program_languages pl WHERE pl.program_id = p.id LIMIT 1),
    p.language
  ) AS language,
  -- All languages as array
  COALESCE(
    (SELECT array_agg(pl.language_code) FROM public.program_languages pl WHERE pl.program_id = p.id),
    ARRAY[p.language]
  ) AS languages,
  -- USD conversion for tuition (CORRECT formula: local * rate_to_usd)
  CASE 
    WHEN COALESCE(p.tuition_is_free, false) = true THEN 0
    WHEN UPPER(COALESCE(p.currency_code, 'USD')) = 'USD' THEN COALESCE(p.tuition_local_min, p.tuition_usd_min, 0)
    WHEN fx.rate_to_usd IS NULL THEN COALESCE(p.tuition_usd_min, 0)
    ELSE ROUND(COALESCE(p.tuition_local_min, 0) * fx.rate_to_usd, 2)
  END AS tuition_usd_min,
  CASE 
    WHEN COALESCE(p.tuition_is_free, false) = true THEN 0
    WHEN UPPER(COALESCE(p.currency_code, 'USD')) = 'USD' THEN COALESCE(p.tuition_local_max, p.tuition_usd_max, 0)
    WHEN fx.rate_to_usd IS NULL THEN COALESCE(p.tuition_usd_max, 0)
    ELSE ROUND(COALESCE(p.tuition_local_max, 0) * fx.rate_to_usd, 2)
  END AS tuition_usd_max,
  p.currency_code,
  COALESCE(p.tuition_local_min, p.tuition_local_max) AS tuition_local_amount,
  p.tuition_is_free,
  u.ranking,
  p.duration_months,
  ('/program/' || p.id::text) AS portal_url,
  p.is_active,
  p.publish_status,
  u.monthly_living AS university_monthly_living,
  u.monthly_living AS monthly_living,
  -- Dorm info with CORRECT USD conversion (local * rate_to_usd)
  u.has_dorm,
  u.dorm_price_monthly_local,
  u.dorm_currency_code,
  CASE 
    WHEN COALESCE(u.has_dorm, false) = false THEN NULL
    WHEN u.dorm_currency_code IS NULL THEN NULL
    WHEN UPPER(u.dorm_currency_code) = 'USD' THEN u.dorm_price_monthly_local
    WHEN dorm_fx.rate_to_usd IS NULL THEN NULL
    ELSE ROUND(u.dorm_price_monthly_local * dorm_fx.rate_to_usd, 2)
  END AS dorm_price_monthly_usd
FROM public.programs p
JOIN public.universities u ON u.id = p.university_id
JOIN public.countries c ON c.id = u.country_id
LEFT JOIN public.degrees deg ON deg.id = p.degree_id
LEFT JOIN public.disciplines disc ON disc.id = p.discipline_id
LEFT JOIN public.fx_rates fx ON UPPER(fx.currency_code) = UPPER(p.currency_code)
LEFT JOIN public.fx_rates dorm_fx ON UPPER(dorm_fx.currency_code) = UPPER(u.dorm_currency_code)
WHERE p.is_active = true
  AND p.publish_status = 'published'
  AND COALESCE(u.is_active, true) = true;