
DROP FUNCTION IF EXISTS public.rpc_map_city_summary(TEXT, TEXT, NUMERIC);

CREATE OR REPLACE FUNCTION public.rpc_map_city_summary(
  p_country_code TEXT,
  p_degree_slug TEXT DEFAULT NULL,
  p_fees_max NUMERIC DEFAULT NULL
)
RETURNS TABLE (
  city TEXT,
  universities_count BIGINT,
  programs_count BIGINT,
  fee_min NUMERIC,
  fee_max NUMERIC,
  city_lat DOUBLE PRECISION,
  city_lon DOUBLE PRECISION
)
LANGUAGE sql STABLE
AS $$
  SELECT
    COALESCE(v.city, '__unknown__') AS city,
    COUNT(DISTINCT v.university_id) AS universities_count,
    COUNT(DISTINCT v.program_id) AS programs_count,
    MIN(v.tuition_usd_year_min) AS fee_min,
    MAX(v.tuition_usd_year_max) AS fee_max,
    cc.lat AS city_lat,
    cc.lon AS city_lon
  FROM public.vw_program_search_api_v3_final v
  LEFT JOIN public.city_coordinates cc
    ON LOWER(cc.city_name) = LOWER(COALESCE(v.city, '__unknown__'))
    AND UPPER(cc.country_code) = UPPER(v.country_code)
  WHERE v.is_active = true
    AND v.publish_status = 'published'
    AND v.do_not_offer = false
    AND UPPER(v.country_code) = UPPER(p_country_code)
    AND (p_degree_slug IS NULL OR v.degree_slug = p_degree_slug)
    AND (p_fees_max IS NULL OR v.tuition_usd_year_min <= p_fees_max)
  GROUP BY COALESCE(v.city, '__unknown__'), cc.lat, cc.lon
  HAVING COUNT(DISTINCT v.university_id) > 0
  ORDER BY COUNT(DISTINCT v.university_id) DESC;
$$;
