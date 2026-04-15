
CREATE OR REPLACE FUNCTION public.rpc_admin_door2_review_queue(
  p_filters jsonb DEFAULT '{}'::jsonb,
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage text := p_filters->>'stage';
  v_time_window text := p_filters->>'time_window';
  v_search text := p_filters->>'search';
  v_country text := p_filters->>'country_code';
  v_run_id text := p_filters->>'run_id';
  v_source text := p_filters->>'source';
  v_cutoff timestamptz;
  v_offset int := (p_page - 1) * p_page_size;
  v_total int;
  v_rows jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF v_time_window = '15m' THEN v_cutoff := now() - interval '15 minutes';
  ELSIF v_time_window = '1h' THEN v_cutoff := now() - interval '1 hour';
  ELSIF v_time_window = '6h' THEN v_cutoff := now() - interval '6 hours';
  ELSIF v_time_window = '24h' THEN v_cutoff := now() - interval '24 hours';
  ELSE v_cutoff := NULL;
  END IF;

  -- Count: Door2 unis + QS-only unis
  WITH door2_ids AS (
    SELECT u.id
    FROM uniranks_crawl_state cs
    JOIN universities u ON u.id::text = cs.university_id
    WHERE (v_stage IS NULL OR cs.stage = v_stage)
      AND (v_cutoff IS NULL OR cs.updated_at >= v_cutoff)
      AND (v_search IS NULL OR u.name_en ILIKE '%' || v_search || '%' OR u.name ILIKE '%' || v_search || '%')
      AND (v_country IS NULL OR u.country_code = v_country)
      AND (v_run_id IS NULL OR cs.door2_run_id = v_run_id)
      AND (v_source IS NULL OR cs.source = v_source)
  ),
  qs_ids AS (
    SELECT DISTINCT pd.university_id::uuid AS id
    FROM program_draft pd
    JOIN universities u ON u.id = pd.university_id
    WHERE pd.schema_version = 'qs_bridge_v1'
      AND pd.review_status IS DISTINCT FROM 'published'
      AND (v_search IS NULL OR u.name_en ILIKE '%' || v_search || '%' OR u.name ILIKE '%' || v_search || '%')
      AND (v_country IS NULL OR u.country_code = v_country)
      AND pd.university_id IS NOT NULL
  ),
  combined AS (
    SELECT id FROM door2_ids
    UNION
    SELECT id FROM qs_ids
  )
  SELECT count(*)::int INTO v_total FROM combined;

  -- Rows
  SELECT jsonb_agg(row_to_json(r)::jsonb)
  INTO v_rows
  FROM (
    WITH door2_ids AS (
      SELECT u.id
      FROM uniranks_crawl_state cs
      JOIN universities u ON u.id::text = cs.university_id
      WHERE (v_stage IS NULL OR cs.stage = v_stage)
        AND (v_cutoff IS NULL OR cs.updated_at >= v_cutoff)
        AND (v_search IS NULL OR u.name_en ILIKE '%' || v_search || '%' OR u.name ILIKE '%' || v_search || '%')
        AND (v_country IS NULL OR u.country_code = v_country)
        AND (v_run_id IS NULL OR cs.door2_run_id = v_run_id)
        AND (v_source IS NULL OR cs.source = v_source)
    ),
    qs_ids AS (
      SELECT DISTINCT pd.university_id::uuid AS id
      FROM program_draft pd
      JOIN universities u ON u.id = pd.university_id
      WHERE pd.schema_version = 'qs_bridge_v1'
        AND pd.review_status IS DISTINCT FROM 'published'
        AND (v_search IS NULL OR u.name_en ILIKE '%' || v_search || '%' OR u.name ILIKE '%' || v_search || '%')
        AND (v_country IS NULL OR u.country_code = v_country)
        AND pd.university_id IS NOT NULL
    ),
    combined AS (
      SELECT id FROM door2_ids
      UNION
      SELECT id FROM qs_ids
    )
    SELECT
      u.id,
      u.name,
      u.name_en,
      u.slug,
      u.logo_url,
      u.country_code,
      u.uniranks_rank,
      u.website AS website,
      u.crawl_status,
      u.publish_status,
      cs.stage AS door2_stage,
      cs.updated_at AS door2_updated_at,
      cs.retries AS door2_retries,
      cs.locked_until AS door2_locked_until,
      cs.quarantine_reason AS door2_quarantine,
      cs.source AS door2_source,
      cs.entity_type AS door2_entity_type,
      about_run.status AS about_status,
      logo_run.status AS logo_status,
      profile_run.status AS profile_main_status,
      programs_run.status AS programs_list_status,
      COALESCE(
        (programs_run.details_json->>'links_found')::int,
        (programs_run.details_json->>'total_program_links')::int,
        0
      ) AS program_links_count,
      (SELECT COUNT(*)::int FROM program_draft pd WHERE pd.university_id = u.id) AS program_draft_count,
      (SELECT COUNT(*)::int FROM programs p WHERE p.university_id = u.id AND p.publish_status = 'published') AS programs_published_count
    FROM combined c
    JOIN universities u ON u.id = c.id
    LEFT JOIN uniranks_crawl_state cs ON cs.university_id = u.id::text
    LEFT JOIN LATERAL (
      SELECT sr.status, sr.details_json FROM uniranks_step_runs sr
      WHERE sr.university_id = u.id::text AND sr.section = 'about'
      ORDER BY sr.created_at DESC LIMIT 1
    ) about_run ON true
    LEFT JOIN LATERAL (
      SELECT sr.status, sr.details_json FROM uniranks_step_runs sr
      WHERE sr.university_id = u.id::text AND sr.section = 'logo'
      ORDER BY sr.created_at DESC LIMIT 1
    ) logo_run ON true
    LEFT JOIN LATERAL (
      SELECT sr.status, sr.details_json FROM uniranks_step_runs sr
      WHERE sr.university_id = u.id::text AND sr.section = 'profile_main'
      ORDER BY sr.created_at DESC LIMIT 1
    ) profile_run ON true
    LEFT JOIN LATERAL (
      SELECT sr.status, sr.details_json FROM uniranks_step_runs sr
      WHERE sr.university_id = u.id::text AND sr.section = 'programs_list'
      ORDER BY sr.created_at DESC LIMIT 1
    ) programs_run ON true
    ORDER BY u.uniranks_rank ASC NULLS LAST
    LIMIT p_page_size OFFSET v_offset
  ) r;

  RETURN jsonb_build_object(
    'rows', COALESCE(v_rows, '[]'::jsonb),
    'total', v_total
  );
END;
$$;
