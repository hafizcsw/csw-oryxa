
-- Update rpc_get_door2_live to include source + entity_type columns
DROP FUNCTION IF EXISTS public.rpc_get_door2_live(jsonb, int, int);

CREATE OR REPLACE FUNCTION public.rpc_get_door2_live(
  p_filters jsonb DEFAULT '{}',
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage text := p_filters->>'stage';
  v_time_window text := p_filters->>'time_window';
  v_search text := p_filters->>'search';
  v_source text := p_filters->>'source';
  v_cutoff timestamptz;
  v_offset int := (p_page - 1) * p_page_size;
  v_total int;
  v_rows jsonb;
  v_counters jsonb;
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

  SELECT COUNT(*)::int INTO v_total
  FROM uniranks_crawl_state cs
  JOIN universities u ON u.id::text = cs.university_id
  WHERE (v_stage IS NULL OR cs.stage = v_stage)
    AND (v_cutoff IS NULL OR cs.updated_at >= v_cutoff)
    AND (v_source IS NULL OR cs.source = v_source)
    AND (v_search IS NULL OR u.name_en ILIKE '%' || v_search || '%' OR u.name ILIKE '%' || v_search || '%');

  SELECT jsonb_agg(row_to_json(r)::jsonb)
  INTO v_rows
  FROM (
    SELECT
      cs.university_id,
      u.name,
      u.name_en,
      u.country_code,
      u.uniranks_rank,
      u.logo_url,
      cs.stage,
      cs.retries AS retry_count,
      cs.quarantine_reason,
      cs.updated_at AS last_updated,
      cs.locked_until,
      cs.source,
      cs.entity_type,
      about_run.status AS about_status,
      logo_run.status AS logo_status,
      profile_run.status AS profile_status,
      programs_run.status AS programs_list_status,
      COALESCE(
        (programs_run.details_json->>'links_found')::int,
        (programs_run.details_json->>'total_program_links')::int,
        0
      ) AS program_links_count,
      -- QS-specific: section observation counts (only populated for source=qs)
      CASE WHEN cs.source = 'qs' THEN
        (SELECT COUNT(*)::int FROM qs_section_observations qso
         WHERE qso.entity_id = cs.university_id AND qso.status = 'extracted')
      ELSE NULL END AS qs_sections_extracted,
      CASE WHEN cs.source = 'qs' THEN
        (SELECT COUNT(*)::int FROM qs_section_observations qso
         WHERE qso.entity_id = cs.university_id)
      ELSE NULL END AS qs_sections_total
    FROM uniranks_crawl_state cs
    JOIN universities u ON u.id::text = cs.university_id
    LEFT JOIN LATERAL (
      SELECT sr.status, sr.details_json FROM uniranks_step_runs sr
      WHERE sr.university_id = cs.university_id AND sr.section = 'about'
      ORDER BY sr.created_at DESC LIMIT 1
    ) about_run ON true
    LEFT JOIN LATERAL (
      SELECT sr.status, sr.details_json FROM uniranks_step_runs sr
      WHERE sr.university_id = cs.university_id AND sr.section = 'logo'
      ORDER BY sr.created_at DESC LIMIT 1
    ) logo_run ON true
    LEFT JOIN LATERAL (
      SELECT sr.status, sr.details_json FROM uniranks_step_runs sr
      WHERE sr.university_id = cs.university_id AND sr.section = 'profile_main'
      ORDER BY sr.created_at DESC LIMIT 1
    ) profile_run ON true
    LEFT JOIN LATERAL (
      SELECT sr.status, sr.details_json FROM uniranks_step_runs sr
      WHERE sr.university_id = cs.university_id AND sr.section = 'programs_list'
      ORDER BY sr.created_at DESC LIMIT 1
    ) programs_run ON true
    WHERE (v_stage IS NULL OR cs.stage = v_stage)
      AND (v_cutoff IS NULL OR cs.updated_at >= v_cutoff)
      AND (v_source IS NULL OR cs.source = v_source)
      AND (v_search IS NULL OR u.name_en ILIKE '%' || v_search || '%' OR u.name ILIKE '%' || v_search || '%')
    ORDER BY u.uniranks_rank ASC NULLS LAST
    LIMIT p_page_size OFFSET v_offset
  ) r;

  SELECT jsonb_build_object(
    'processed_15m', (SELECT COUNT(*) FROM uniranks_crawl_state WHERE updated_at >= now() - interval '15 minutes')::int,
    'errors_15m', (SELECT COUNT(*) FROM uniranks_crawl_state WHERE quarantine_reason IS NOT NULL AND updated_at >= now() - interval '15 minutes')::int,
    'pending_total', (SELECT COUNT(*) FROM uniranks_crawl_state WHERE stage IN ('profile_pending','programs_pending'))::int
  ) INTO v_counters;

  RETURN jsonb_build_object(
    'rows', COALESCE(v_rows, '[]'::jsonb),
    'total', v_total,
    'counters', v_counters
  );
END;
$$;

-- Update rpc_admin_door2_review_queue to include source column
DROP FUNCTION IF EXISTS public.rpc_admin_door2_review_queue(jsonb, int, int);

CREATE OR REPLACE FUNCTION public.rpc_admin_door2_review_queue(
  p_filters jsonb DEFAULT '{}',
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
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

  SELECT COUNT(*)::int INTO v_total
  FROM uniranks_crawl_state cs
  JOIN universities u ON u.id::text = cs.university_id
  WHERE (v_stage IS NULL OR cs.stage = v_stage)
    AND (v_cutoff IS NULL OR cs.updated_at >= v_cutoff)
    AND (v_search IS NULL OR u.name_en ILIKE '%' || v_search || '%' OR u.name ILIKE '%' || v_search || '%')
    AND (v_country IS NULL OR u.country_code = v_country)
    AND (v_run_id IS NULL OR cs.door2_run_id = v_run_id)
    AND (v_source IS NULL OR cs.source = v_source);

  SELECT jsonb_agg(row_to_json(r)::jsonb)
  INTO v_rows
  FROM (
    SELECT
      u.id,
      u.name,
      u.name_en,
      u.slug,
      u.logo_url,
      u.country_code,
      u.uniranks_rank,
      u.official_website AS website,
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
      (SELECT COUNT(*)::int FROM program_drafts pd WHERE pd.university_id = u.id) AS program_draft_count,
      (SELECT COUNT(*)::int FROM programs p WHERE p.university_id = u.id AND p.status = 'published') AS programs_published_count
    FROM uniranks_crawl_state cs
    JOIN universities u ON u.id::text = cs.university_id
    LEFT JOIN LATERAL (
      SELECT sr.status, sr.details_json FROM uniranks_step_runs sr
      WHERE sr.university_id = cs.university_id AND sr.section = 'about'
      ORDER BY sr.created_at DESC LIMIT 1
    ) about_run ON true
    LEFT JOIN LATERAL (
      SELECT sr.status, sr.details_json FROM uniranks_step_runs sr
      WHERE sr.university_id = cs.university_id AND sr.section = 'logo'
      ORDER BY sr.created_at DESC LIMIT 1
    ) logo_run ON true
    LEFT JOIN LATERAL (
      SELECT sr.status, sr.details_json FROM uniranks_step_runs sr
      WHERE sr.university_id = cs.university_id AND sr.section = 'profile_main'
      ORDER BY sr.created_at DESC LIMIT 1
    ) profile_run ON true
    LEFT JOIN LATERAL (
      SELECT sr.status, sr.details_json FROM uniranks_step_runs sr
      WHERE sr.university_id = cs.university_id AND sr.section = 'programs_list'
      ORDER BY sr.created_at DESC LIMIT 1
    ) programs_run ON true
    WHERE (v_stage IS NULL OR cs.stage = v_stage)
      AND (v_cutoff IS NULL OR cs.updated_at >= v_cutoff)
      AND (v_search IS NULL OR u.name_en ILIKE '%' || v_search || '%' OR u.name ILIKE '%' || v_search || '%')
      AND (v_country IS NULL OR u.country_code = v_country)
      AND (v_run_id IS NULL OR cs.door2_run_id = v_run_id)
      AND (v_source IS NULL OR cs.source = v_source)
    ORDER BY u.uniranks_rank ASC NULLS LAST
    LIMIT p_page_size OFFSET v_offset
  ) r;

  RETURN jsonb_build_object(
    'rows', COALESCE(v_rows, '[]'::jsonb),
    'total', v_total
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
