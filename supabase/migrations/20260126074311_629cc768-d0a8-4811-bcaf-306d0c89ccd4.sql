-- ============================================
-- PORTAL BLOCKERS FIX MIGRATION
-- ============================================

-- 1. Fix portal_url in vw_program_search_api
-- Recreate with correct portal_url format: /program/{id}
DROP VIEW IF EXISTS public.vw_program_search_api;

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
    COALESCE(( SELECT pl.language_code
           FROM program_languages pl
          WHERE pl.program_id = p.id
         LIMIT 1), p.language) AS language,
    COALESCE(( SELECT array_agg(pl.language_code) AS array_agg
           FROM program_languages pl
          WHERE pl.program_id = p.id),
        CASE
            WHEN p.language IS NOT NULL THEN ARRAY[p.language]
            ELSE ARRAY[]::text[]
        END) AS languages,
    CASE
        WHEN COALESCE(p.tuition_is_free, false) THEN 0::numeric
        WHEN upper(COALESCE(p.currency_code, 'USD'::text)) = 'USD'::text THEN COALESCE(p.tuition_local_min, p.tuition_usd_min)
        ELSE round(COALESCE(p.tuition_local_min, 0::numeric) / COALESCE(fx.rate_to_usd, 1::numeric))
    END AS tuition_usd_min,
    CASE
        WHEN COALESCE(p.tuition_is_free, false) THEN 0::numeric
        WHEN upper(COALESCE(p.currency_code, 'USD'::text)) = 'USD'::text THEN COALESCE(p.tuition_local_max, p.tuition_usd_max)
        ELSE round(COALESCE(p.tuition_local_max, 0::numeric) / COALESCE(fx.rate_to_usd, 1::numeric))
    END AS tuition_usd_max,
    p.currency_code,
    p.tuition_local_min AS tuition_local_amount,
    COALESCE(p.tuition_is_free, false) AS tuition_is_free,
    u.ranking,
    p.duration_months,
    -- ✅ FIXED: portal_url now matches Route /program/:id
    ('/program/' || p.id::text) AS portal_url,
    COALESCE(p.is_active, true) AS is_active,
    COALESCE(p.publish_status, 'draft'::text) AS publish_status,
    u.monthly_living AS university_monthly_living,
    u.monthly_living,
    COALESCE(u.has_dorm, false) AS has_dorm,
    u.dorm_price_monthly_local,
    u.dorm_currency_code,
    CASE
        WHEN NOT COALESCE(u.has_dorm, false) THEN NULL::numeric
        WHEN u.dorm_currency_code IS NULL THEN u.dorm_price_monthly_local
        WHEN upper(u.dorm_currency_code) = 'USD'::text THEN u.dorm_price_monthly_local
        ELSE round(COALESCE(u.dorm_price_monthly_local, 0::numeric) / COALESCE(fx_dorm.rate_to_usd, 1::numeric))
    END AS dorm_price_monthly_usd
FROM programs p
JOIN universities u ON u.id = p.university_id
JOIN countries c ON c.id = u.country_id
LEFT JOIN degrees deg ON deg.id = p.degree_id
LEFT JOIN disciplines disc ON disc.id = p.discipline_id
LEFT JOIN fx_rates fx ON upper(fx.currency_code) = upper(p.currency_code)
LEFT JOIN fx_rates fx_dorm ON upper(fx_dorm.currency_code) = upper(u.dorm_currency_code)
WHERE p.university_id IS NOT NULL AND u.country_id IS NOT NULL;

-- Grant access
GRANT SELECT ON public.vw_program_search_api TO anon, authenticated;

-- ============================================
-- 2. Seed Dorm Data (using subquery, not LIMIT)
-- ============================================
UPDATE universities 
SET 
  has_dorm = true,
  dorm_price_monthly_local = 1500,
  dorm_currency_code = 'RUB'
WHERE id = (
  SELECT u.id 
  FROM universities u
  JOIN countries c ON c.id = u.country_id
  WHERE c.country_code = 'RU'
  AND COALESCE(u.is_active, true) = true
  ORDER BY u.name
  LIMIT 1
);

-- ============================================
-- 3. Cleanup RLS policies on scholarships
-- ============================================
DROP POLICY IF EXISTS sch_admin_delete ON scholarships;
DROP POLICY IF EXISTS sch_admin_update ON scholarships;
DROP POLICY IF EXISTS sch_admin_write ON scholarships;

-- Recreate clean policies
DROP POLICY IF EXISTS scholarships_admin_all ON scholarships;
DROP POLICY IF EXISTS scholarships_public_read ON scholarships;

CREATE POLICY scholarships_admin_all ON scholarships
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY scholarships_public_read ON scholarships
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published' AND COALESCE(is_active, true) = true);