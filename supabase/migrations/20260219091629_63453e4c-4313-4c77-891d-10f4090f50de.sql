
CREATE OR REPLACE FUNCTION public.rpc_admin_door2_review_queue(
  p_country_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_stage_filters text[] DEFAULT NULL,
  p_updated_since interval DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  WITH unis AS (
    SELECT
      u.id,
      u.slug,
      u.name AS name,
      COALESCE(u.name_en, u.name) AS name_en,
      u.logo_url,
      u.country_id,
      u.country_code,
      u.uniranks_rank,
      u.website AS website,
      u.crawl_status,
      u.publish_status,
      cs.stage AS door2_stage,
      cs.updated_at AS door2_updated_at,
      cs.retries AS door2_retries,
      cs.quarantine_reason AS door2_quarantine,
      (SELECT count(*) FROM program_drafts pd WHERE pd.university_id = u.id) AS program_draft_count,
      (SELECT count(*) FROM programs p WHERE p.university_id = u.id AND p.status = 'published') AS programs_published_count,
      sr_about.status AS about_status,
      sr_logo.status AS logo_status,
      sr_profile.status AS profile_main_status,
      sr_programs.status AS programs_list_status,
      COALESCE(
        (sr_programs.details_json->>'links_found')::int,
        (sr_programs.details_json->>'total_program_links')::int,
        0
      ) AS program_links_count
    FROM universities u
    LEFT JOIN uniranks_crawl_state cs ON cs.university_id = u.id
    LEFT JOIN LATERAL (
      SELECT sr.status, sr.details_json FROM uniranks_step_runs sr
      WHERE sr.university_id = u.id AND sr.section = 'about'
      ORDER BY sr.created_at DESC LIMIT 1
    ) sr_about ON true
    LEFT JOIN LATERAL (
      SELECT sr.status, sr.details_json FROM uniranks_step_runs sr
      WHERE sr.university_id = u.id AND sr.section = 'logo'
      ORDER BY sr.created_at DESC LIMIT 1
    ) sr_logo ON true
    LEFT JOIN LATERAL (
      SELECT sr.status, sr.details_json FROM uniranks_step_runs sr
      WHERE sr.university_id = u.id AND sr.section = 'profile_main'
      ORDER BY sr.created_at DESC LIMIT 1
    ) sr_profile ON true
    LEFT JOIN LATERAL (
      SELECT sr.status, sr.details_json FROM uniranks_step_runs sr
      WHERE sr.university_id = u.id AND sr.section = 'programs_list'
      ORDER BY sr.created_at DESC LIMIT 1
    ) sr_programs ON true
    WHERE
      (p_country_id IS NULL OR u.country_id = p_country_id)
      AND (p_search IS NULL OR p_search = '' OR u.name ILIKE '%' || p_search || '%' OR u.name_en ILIKE '%' || p_search || '%')
      AND (p_stage_filters IS NULL OR cs.stage = ANY(p_stage_filters))
      AND (p_updated_since IS NULL OR cs.updated_at >= now() - p_updated_since)
      AND cs.university_id IS NOT NULL
    ORDER BY u.uniranks_rank ASC NULLS LAST
    LIMIT p_limit OFFSET p_offset
  )
  SELECT jsonb_agg(row_to_json(unis)::jsonb) INTO v_result FROM unis;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
