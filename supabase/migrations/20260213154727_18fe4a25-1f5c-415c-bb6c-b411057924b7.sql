
-- Drop any existing signatures to prevent ambiguity
DROP FUNCTION IF EXISTS public.admin_list_universities(text, uuid, int, int);

CREATE OR REPLACE FUNCTION public.admin_list_universities(
  p_search text DEFAULT '',
  p_country_id uuid DEFAULT NULL,
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 50
)
RETURNS json AS $$
DECLARE
  v_offset int := (p_page - 1) * p_page_size;
  v_total bigint;
  v_data json;
BEGIN
  SELECT count(*) INTO v_total
  FROM universities u
  WHERE (p_search = '' OR u.name ILIKE '%' || p_search || '%')
    AND (p_country_id IS NULL OR u.country_id = p_country_id);

  SELECT json_agg(row_to_json(t)) INTO v_data
  FROM (
    SELECT u.id, u.name, u.country_id, u.city, u.logo_url, u.website,
           u.is_active, u.cwur_world_rank, u.cwur_national_rank,
           u.cwur_education_rank, u.cwur_employability_rank,
           u.cwur_faculty_rank, u.cwur_research_rank, u.cwur_score,
           c.name_ar as country_name
    FROM universities u
    LEFT JOIN countries c ON c.id = u.country_id
    WHERE (p_search = '' OR u.name ILIKE '%' || p_search || '%')
      AND (p_country_id IS NULL OR u.country_id = p_country_id)
    ORDER BY u.name ASC
    LIMIT p_page_size OFFSET v_offset
  ) t;

  RETURN json_build_object('data', COALESCE(v_data, '[]'::json), 'total', v_total);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
