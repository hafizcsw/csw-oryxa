
-- Door2 Live monitoring RPC
-- Returns universities with their Door2 crawl state + step statuses

DROP FUNCTION IF EXISTS public.rpc_get_door2_live(jsonb, int, int);

CREATE OR REPLACE FUNCTION public.rpc_get_door2_live(
  p_filters jsonb DEFAULT '{}'::jsonb,
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_offset int := (p_page - 1) * p_page_size;
  v_stage text := p_filters->>'stage';
  v_time_window text := coalesce(p_filters->>'time_window', '24h');
  v_search text := p_filters->>'search';
  v_country_code text := p_filters->>'country_code';
  v_since timestamptz;
  v_total int;
  v_rows jsonb;
  v_counters jsonb;
  v_processed_15m int;
  v_errors_15m int;
  v_pending_total int;
BEGIN
  -- Parse time window
  v_since := CASE v_time_window
    WHEN '15m' THEN now() - interval '15 minutes'
    WHEN '1h' THEN now() - interval '1 hour'
    WHEN '6h' THEN now() - interval '6 hours'
    WHEN '24h' THEN now() - interval '24 hours'
    WHEN 'all' THEN '2020-01-01'::timestamptz
    ELSE now() - interval '24 hours'
  END;

  -- Counters
  SELECT COUNT(*) INTO v_processed_15m
  FROM uniranks_crawl_state
  WHERE stage = 'done' AND updated_at >= now() - interval '15 minutes';

  SELECT COUNT(*) INTO v_errors_15m
  FROM uniranks_crawl_state
  WHERE quarantine_reason IS NOT NULL AND updated_at >= now() - interval '15 minutes';

  SELECT COUNT(*) INTO v_pending_total
  FROM uniranks_crawl_state
  WHERE stage IN ('profile_pending','programs_pending','details_pending');

  v_counters := jsonb_build_object(
    'processed_15m', v_processed_15m,
    'errors_15m', v_errors_15m,
    'pending_total', v_pending_total
  );

  -- Count total matching
  SELECT count(*) INTO v_total
  FROM uniranks_crawl_state cs
  JOIN universities u ON u.id::text = cs.university_id
  WHERE cs.updated_at >= v_since
    AND (v_stage IS NULL OR cs.stage = v_stage)
    AND (v_country_code IS NULL OR u.country_code = v_country_code)
    AND (v_search IS NULL OR u.name ILIKE '%' || v_search || '%' OR u.name_en ILIKE '%' || v_search || '%');

  -- Fetch rows with step statuses
  SELECT coalesce(jsonb_agg(row_data), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT jsonb_build_object(
      'university_id', cs.university_id,
      'name', u.name,
      'name_en', u.name_en,
      'country_code', u.country_code,
      'uniranks_rank', u.uniranks_rank,
      'logo_url', u.logo_url,
      'stage', cs.stage,
      'retry_count', cs.retry_count,
      'quarantine_reason', cs.quarantine_reason,
      'last_updated', cs.updated_at,
      'locked_until', cs.locked_until,
      'about_status', (SELECT sr.status FROM uniranks_step_runs sr WHERE sr.university_id = cs.university_id AND sr.section = 'about' ORDER BY sr.created_at DESC LIMIT 1),
      'logo_status', (SELECT sr.status FROM uniranks_step_runs sr WHERE sr.university_id = cs.university_id AND sr.section = 'logo' ORDER BY sr.created_at DESC LIMIT 1),
      'profile_status', (SELECT sr.status FROM uniranks_step_runs sr WHERE sr.university_id = cs.university_id AND sr.section = 'profile_main' ORDER BY sr.created_at DESC LIMIT 1),
      'programs_list_status', (SELECT sr.status FROM uniranks_step_runs sr WHERE sr.university_id = cs.university_id AND sr.section = 'programs_list' ORDER BY sr.created_at DESC LIMIT 1),
      'program_links_count', (SELECT count(*) FROM program_urls pu WHERE pu.university_id = cs.university_id)
    ) AS row_data
    FROM uniranks_crawl_state cs
    JOIN universities u ON u.id::text = cs.university_id
    WHERE cs.updated_at >= v_since
      AND (v_stage IS NULL OR cs.stage = v_stage)
      AND (v_country_code IS NULL OR u.country_code = v_country_code)
      AND (v_search IS NULL OR u.name ILIKE '%' || v_search || '%' OR u.name_en ILIKE '%' || v_search || '%')
    ORDER BY u.uniranks_rank ASC NULLS LAST
    LIMIT p_page_size OFFSET v_offset
  ) sub;

  RETURN jsonb_build_object(
    'total', v_total,
    'page', p_page,
    'page_size', p_page_size,
    'counters', v_counters,
    'rows', v_rows
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
