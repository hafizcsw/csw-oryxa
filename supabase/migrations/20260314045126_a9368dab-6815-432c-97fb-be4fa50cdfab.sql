DROP FUNCTION IF EXISTS public.rpc_map_city_universities(text,text,text,numeric);
DROP FUNCTION IF EXISTS public.rpc_map_country_universities(text,text,numeric);

CREATE FUNCTION public.rpc_map_city_universities(
  p_country_code text,
  p_city text,
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
  has_dorm boolean,
  dorm_lat double precision,
  dorm_lon double precision,
  dorm_address text,
  dorm_price_monthly_local numeric,
  dorm_currency_code text
)
LANGUAGE sql STABLE
AS $$
  SELECT
    v.university_id::text,
    v.university_name_ar,
    v.university_name_en,
    v.university_logo,
    v.city,
    COUNT(DISTINCT v.program_id) AS programs_count,
    MIN(v.tuition_usd_year_min) AS fee_min,
    MAX(v.tuition_usd_year_max) AS fee_max,
    u.geo_lat,
    u.geo_lon,
    COALESCE(u.has_dorm, false) AS has_dorm,
    u.dorm_lat,
    u.dorm_lon,
    u.dorm_address,
    u.dorm_price_monthly_local,
    u.dorm_currency_code
  FROM public.vw_program_search_api_v3_final v
  JOIN public.universities u ON u.id = v.university_id
  WHERE v.is_active = true
    AND v.publish_status = 'published'
    AND v.do_not_offer = false
    AND UPPER(v.country_code) = UPPER(p_country_code)
    AND (
      (p_city = '__unknown__' AND v.city IS NULL)
      OR v.city = p_city
    )
    AND (p_degree_slug IS NULL OR v.degree_slug = p_degree_slug)
    AND (p_fees_max IS NULL OR v.tuition_usd_year_min <= p_fees_max)
  GROUP BY v.university_id, v.university_name_ar, v.university_name_en, v.university_logo, v.city,
           u.geo_lat, u.geo_lon, u.has_dorm, u.dorm_lat, u.dorm_lon, u.dorm_address, u.dorm_price_monthly_local, u.dorm_currency_code
  ORDER BY COUNT(DISTINCT v.program_id) DESC
  LIMIT 30;
$$;

CREATE FUNCTION public.rpc_map_country_universities(
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
  has_dorm boolean,
  dorm_lat double precision,
  dorm_lon double precision,
  dorm_address text,
  dorm_price_monthly_local numeric,
  dorm_currency_code text
)
LANGUAGE sql STABLE
AS $$
  SELECT
    v.university_id::text,
    v.university_name_ar,
    v.university_name_en,
    v.university_logo,
    v.city,
    COUNT(DISTINCT v.program_id) AS programs_count,
    MIN(v.tuition_usd_year_min) AS fee_min,
    MAX(v.tuition_usd_year_max) AS fee_max,
    u.geo_lat,
    u.geo_lon,
    COALESCE(u.has_dorm, false) AS has_dorm,
    u.dorm_lat,
    u.dorm_lon,
    u.dorm_address,
    u.dorm_price_monthly_local,
    u.dorm_currency_code
  FROM public.vw_program_search_api_v3_final v
  JOIN public.universities u ON u.id = v.university_id
  WHERE v.is_active = true
    AND v.publish_status = 'published'
    AND v.do_not_offer = false
    AND UPPER(v.country_code) = UPPER(p_country_code)
    AND (p_degree_slug IS NULL OR v.degree_slug = p_degree_slug)
    AND (p_fees_max IS NULL OR v.tuition_usd_year_min <= p_fees_max)
  GROUP BY v.university_id, v.university_name_ar, v.university_name_en, v.university_logo, v.city,
           u.geo_lat, u.geo_lon, u.has_dorm, u.dorm_lat, u.dorm_lon, u.dorm_address, u.dorm_price_monthly_local, u.dorm_currency_code
  ORDER BY COUNT(DISTINCT v.program_id) DESC;
$$;