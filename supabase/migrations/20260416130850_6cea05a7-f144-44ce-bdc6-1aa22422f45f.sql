-- Partial index for map query pattern
CREATE INDEX IF NOT EXISTS idx_programs_map_filter
ON programs(university_id, degree_id)
WHERE is_active = true AND publish_status = 'published';

-- ============================================================
-- rpc_map_country_summary: needs programs + universities + countries + degrees + csw_university_guidance
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_map_country_summary(
  p_degree_slug text DEFAULT NULL,
  p_fees_max numeric DEFAULT NULL
)
RETURNS TABLE(
  country_code text,
  country_name_ar text,
  country_name_en text,
  universities_count bigint,
  programs_count bigint,
  fee_min numeric,
  fee_max numeric
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT
    c.country_code,
    c.name_ar AS country_name_ar,
    c.name_en AS country_name_en,
    COUNT(DISTINCT u.id) AS universities_count,
    COUNT(DISTINCT p.id) AS programs_count,
    MIN(p.tuition_usd_min) AS fee_min,
    MAX(p.tuition_usd_max) AS fee_max
  FROM programs p
  JOIN universities u ON u.id = p.university_id
  JOIN countries c ON c.id = u.country_id
  LEFT JOIN degrees d ON d.id = p.degree_id
  LEFT JOIN csw_university_guidance ug ON ug.university_id = u.id
  WHERE p.is_active = true
    AND p.publish_status = 'published'
    AND COALESCE(ug.do_not_offer, false) = false
    AND (p_degree_slug IS NULL OR d.slug = p_degree_slug)
    AND (p_fees_max IS NULL OR p.tuition_usd_min <= p_fees_max)
  GROUP BY c.country_code, c.name_ar, c.name_en
  HAVING COUNT(DISTINCT u.id) > 0
  ORDER BY COUNT(DISTINCT u.id) DESC;
$function$;

-- ============================================================
-- rpc_map_city_summary: needs programs + universities + countries + degrees + csw_university_guidance + city_coordinates
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_map_city_summary(
  p_country_code text,
  p_degree_slug text DEFAULT NULL,
  p_fees_max numeric DEFAULT NULL
)
RETURNS TABLE(
  city text,
  universities_count bigint,
  programs_count bigint,
  fee_min numeric,
  fee_max numeric,
  city_lat double precision,
  city_lon double precision
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT
    COALESCE(u.city, '__unknown__') AS city,
    COUNT(DISTINCT u.id) AS universities_count,
    COUNT(DISTINCT p.id) AS programs_count,
    MIN(p.tuition_usd_min) AS fee_min,
    MAX(p.tuition_usd_max) AS fee_max,
    cc.lat AS city_lat,
    cc.lon AS city_lon
  FROM programs p
  JOIN universities u ON u.id = p.university_id
  JOIN countries c ON c.id = u.country_id
  LEFT JOIN degrees d ON d.id = p.degree_id
  LEFT JOIN csw_university_guidance ug ON ug.university_id = u.id
  LEFT JOIN city_coordinates cc
    ON LOWER(cc.city_name) = LOWER(COALESCE(u.city, '__unknown__'))
    AND UPPER(cc.country_code) = c.country_code
  WHERE p.is_active = true
    AND p.publish_status = 'published'
    AND COALESCE(ug.do_not_offer, false) = false
    AND UPPER(c.country_code) = UPPER(p_country_code)
    AND (p_degree_slug IS NULL OR d.slug = p_degree_slug)
    AND (p_fees_max IS NULL OR p.tuition_usd_min <= p_fees_max)
  GROUP BY COALESCE(u.city, '__unknown__'), cc.lat, cc.lon
  HAVING COUNT(DISTINCT u.id) > 0
  ORDER BY COUNT(DISTINCT u.id) DESC;
$function$;

-- ============================================================
-- rpc_map_country_universities: needs programs + universities + countries + degrees + csw_university_guidance + university_i18n
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_map_country_universities(
  p_country_code text,
  p_degree_slug text DEFAULT NULL,
  p_fees_max numeric DEFAULT NULL
)
RETURNS TABLE(
  university_id text,
  university_name_ar text,
  university_name_en text,
  university_logo text,
  city text,
  programs_count bigint,
  fee_min numeric,
  fee_max numeric,
  geo_lat double precision,
  geo_lon double precision,
  geo_source text,
  has_dorm boolean,
  dorm_lat double precision,
  dorm_lon double precision,
  dorm_address text,
  dorm_price_monthly_local numeric,
  dorm_currency_code text
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT
    u.id::text AS university_id,
    COALESCE(ui_ar.name, ui_en.name, u.name) AS university_name_ar,
    COALESCE(ui_en.name, ui_ar.name, u.name) AS university_name_en,
    u.logo_url AS university_logo,
    u.city,
    COUNT(DISTINCT p.id) AS programs_count,
    MIN(p.tuition_usd_min) AS fee_min,
    MAX(p.tuition_usd_max) AS fee_max,
    u.geo_lat,
    u.geo_lon,
    u.geo_source,
    COALESCE(u.has_dorm, false) AS has_dorm,
    u.dorm_lat,
    u.dorm_lon,
    u.dorm_address,
    u.dorm_price_monthly_local,
    u.dorm_currency_code
  FROM programs p
  JOIN universities u ON u.id = p.university_id
  JOIN countries c ON c.id = u.country_id
  LEFT JOIN degrees d ON d.id = p.degree_id
  LEFT JOIN csw_university_guidance ug ON ug.university_id = u.id
  LEFT JOIN university_i18n ui_ar ON ui_ar.university_id = u.id AND ui_ar.lang_code = 'ar'
  LEFT JOIN university_i18n ui_en ON ui_en.university_id = u.id AND ui_en.lang_code = 'en'
  WHERE p.is_active = true
    AND p.publish_status = 'published'
    AND COALESCE(ug.do_not_offer, false) = false
    AND UPPER(c.country_code) = UPPER(p_country_code)
    AND (p_degree_slug IS NULL OR d.slug = p_degree_slug)
    AND (p_fees_max IS NULL OR p.tuition_usd_min <= p_fees_max)
  GROUP BY u.id, u.name, u.logo_url, u.city,
           u.geo_lat, u.geo_lon, u.geo_source,
           u.has_dorm, u.dorm_lat, u.dorm_lon, u.dorm_address,
           u.dorm_price_monthly_local, u.dorm_currency_code,
           ui_ar.name, ui_en.name
  ORDER BY COUNT(DISTINCT p.id) DESC;
$function$;
