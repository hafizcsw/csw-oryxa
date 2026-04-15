
-- RPC: All universities in a country (for region-level client-side filtering)
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
    AND (p_degree_slug IS NULL OR v.degree_slug = p_degree_slug)
    AND (p_fees_max IS NULL OR v.tuition_usd_year_min <= p_fees_max)
  GROUP BY v.university_id, v.university_name_ar, v.university_name_en, v.university_logo, v.city
  ORDER BY COUNT(DISTINCT v.program_id) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_map_country_universities TO anon, authenticated;
