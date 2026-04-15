
-- ============================================================
-- MAP RPCs: Server-side aggregation on vw_program_search_api_v3_final
-- Ensures map/sidebar use same SoT as /search
-- ============================================================

-- 1) Country summary: distinct universities + programs per country
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
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT
    v.country_code,
    v.country_name_ar,
    v.country_name_en,
    COUNT(DISTINCT v.university_id) AS universities_count,
    COUNT(DISTINCT v.program_id) AS programs_count,
    MIN(v.tuition_usd_year_min) AS fee_min,
    MAX(v.tuition_usd_year_max) AS fee_max
  FROM public.vw_program_search_api_v3_final v
  WHERE v.is_active = true
    AND v.publish_status = 'published'
    AND v.do_not_offer = false
    AND (p_degree_slug IS NULL OR v.degree_slug = p_degree_slug)
    AND (p_fees_max IS NULL OR v.tuition_usd_year_min <= p_fees_max)
  GROUP BY v.country_code, v.country_name_ar, v.country_name_en
  HAVING COUNT(DISTINCT v.university_id) > 0
  ORDER BY COUNT(DISTINCT v.university_id) DESC;
$$;

-- 2) City summary within a country
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
  fee_max numeric
)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT
    v.city,
    COUNT(DISTINCT v.university_id) AS universities_count,
    COUNT(DISTINCT v.program_id) AS programs_count,
    MIN(v.tuition_usd_year_min) AS fee_min,
    MAX(v.tuition_usd_year_max) AS fee_max
  FROM public.vw_program_search_api_v3_final v
  WHERE v.is_active = true
    AND v.publish_status = 'published'
    AND v.do_not_offer = false
    AND UPPER(v.country_code) = UPPER(p_country_code)
    AND v.city IS NOT NULL
    AND (p_degree_slug IS NULL OR v.degree_slug = p_degree_slug)
    AND (p_fees_max IS NULL OR v.tuition_usd_year_min <= p_fees_max)
  GROUP BY v.city
  HAVING COUNT(DISTINCT v.university_id) > 0
  ORDER BY COUNT(DISTINCT v.university_id) DESC;
$$;

-- 3) Universities in a city (filtered, from same SoT)
CREATE OR REPLACE FUNCTION public.rpc_map_city_universities(
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
  fee_max numeric
)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT
    v.university_id::text,
    v.university_name_ar,
    v.university_name_en,
    v.university_logo,
    v.city,
    COUNT(DISTINCT v.program_id) AS programs_count,
    MIN(v.tuition_usd_year_min) AS fee_min,
    MAX(v.tuition_usd_year_max) AS fee_max
  FROM public.vw_program_search_api_v3_final v
  WHERE v.is_active = true
    AND v.publish_status = 'published'
    AND v.do_not_offer = false
    AND UPPER(v.country_code) = UPPER(p_country_code)
    AND v.city = p_city
    AND (p_degree_slug IS NULL OR v.degree_slug = p_degree_slug)
    AND (p_fees_max IS NULL OR v.tuition_usd_year_min <= p_fees_max)
  GROUP BY v.university_id, v.university_name_ar, v.university_name_en, v.university_logo, v.city
  ORDER BY COUNT(DISTINCT v.program_id) DESC
  LIMIT 30;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION public.rpc_map_country_summary TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_map_city_summary TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_map_city_universities TO anon, authenticated;
