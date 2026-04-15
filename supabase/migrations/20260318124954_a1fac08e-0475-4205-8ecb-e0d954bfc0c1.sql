CREATE OR REPLACE FUNCTION public.admin_list_universities(
  p_search text DEFAULT '',
  p_country_id uuid DEFAULT NULL,
  p_is_active boolean DEFAULT NULL,
  p_has_country boolean DEFAULT NULL,
  p_has_city boolean DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '15s'
AS $function$
DECLARE
  v_offset int := (p_page - 1) * p_page_size;
  v_total bigint;
  v_data json;
BEGIN
  SELECT count(*) INTO v_total
  FROM universities u
  WHERE (p_search = '' OR u.name ILIKE '%' || p_search || '%')
    AND (p_country_id IS NULL OR u.country_id = p_country_id)
    AND (p_is_active IS NULL OR COALESCE(u.is_active, true) = p_is_active)
    AND (p_has_country IS NULL OR (p_has_country = true AND u.country_id IS NOT NULL) OR (p_has_country = false AND u.country_id IS NULL))
    AND (p_has_city IS NULL OR (p_has_city = true AND u.city IS NOT NULL AND u.city != '' AND u.city != 'NaN') OR (p_has_city = false AND (u.city IS NULL OR u.city = '' OR u.city = 'NaN')));

  SELECT json_agg(row_to_json(t)) INTO v_data
  FROM (
    SELECT u.id, u.name, u.country_id, u.city, u.logo_url, u.website,
           COALESCE(u.is_active, true) as is_active,
           u.cwur_world_rank, u.cwur_national_rank,
           u.cwur_education_rank, u.cwur_employability_rank,
           u.cwur_faculty_rank, u.cwur_research_rank, u.cwur_score,
           c.name_ar as country_name
    FROM universities u
    LEFT JOIN countries c ON c.id = u.country_id
    WHERE (p_search = '' OR u.name ILIKE '%' || p_search || '%')
      AND (p_country_id IS NULL OR u.country_id = p_country_id)
      AND (p_is_active IS NULL OR COALESCE(u.is_active, true) = p_is_active)
      AND (p_has_country IS NULL OR (p_has_country = true AND u.country_id IS NOT NULL) OR (p_has_country = false AND u.country_id IS NULL))
      AND (p_has_city IS NULL OR (p_has_city = true AND u.city IS NOT NULL AND u.city != '' AND u.city != 'NaN') OR (p_has_city = false AND (u.city IS NULL OR u.city = '' OR u.city = 'NaN')))
    ORDER BY u.cwur_world_rank ASC NULLS LAST, u.name ASC
    LIMIT p_page_size OFFSET v_offset
  ) t;

  RETURN json_build_object('data', COALESCE(v_data, '[]'::json), 'total', v_total);
END;
$function$;