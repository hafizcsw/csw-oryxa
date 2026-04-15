
CREATE OR REPLACE FUNCTION public.rpc_admin_door2_review_countries(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage text;
  v_time_window text;
  v_search text;
  v_run_id text;
  v_interval interval;
  v_result jsonb;
  v_counters jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_stage := p_filters->>'stage';
  v_time_window := p_filters->>'time_window';
  v_search := p_filters->>'search';
  v_run_id := p_filters->>'run_id';

  v_interval := CASE v_time_window
    WHEN '15m' THEN interval '15 minutes'
    WHEN '1h'  THEN interval '1 hour'
    WHEN '6h'  THEN interval '6 hours'
    WHEN '24h' THEN interval '24 hours'
    ELSE NULL
  END;

  SELECT jsonb_build_object(
    'processed_15m', (
      SELECT count(*) FROM public.uniranks_crawl_state cs
      WHERE cs.updated_at >= now() - interval '15 minutes'
        AND cs.stage = 'done'
        AND (v_run_id IS NULL OR cs.door2_run_id = v_run_id)
    ),
    'errors_15m', (
      SELECT count(*) FROM public.uniranks_crawl_state cs
      WHERE cs.quarantine_reason IS NOT NULL
        AND cs.quarantined_at >= now() - interval '15 minutes'
        AND (v_run_id IS NULL OR cs.door2_run_id = v_run_id)
    ),
    'pending_total', (
      SELECT count(*) FROM public.program_draft pd
      WHERE pd.review_status IS DISTINCT FROM 'published'
        AND pd.schema_version IN ('door2-detail-v1', 'qs_bridge_v1')
    )
  ) INTO v_counters;

  WITH door2_unis AS (
    SELECT u.country_id, u.id
    FROM public.universities u
    JOIN public.uniranks_crawl_state cs ON cs.university_id = u.id::text
    WHERE
      (v_run_id IS NULL OR cs.door2_run_id = v_run_id)
      AND (v_stage IS NULL OR v_stage = '' OR cs.stage = v_stage)
      AND (v_interval IS NULL OR cs.updated_at >= now() - v_interval)
      AND (v_search IS NULL OR v_search = '' OR u.name ILIKE '%' || v_search || '%' OR u.name_en ILIKE '%' || v_search || '%')
      AND cs.stage = 'done'
      AND EXISTS (
        SELECT 1 FROM public.program_draft pd
        WHERE pd.university_id = u.id
          AND pd.schema_version = 'door2-detail-v1'
        LIMIT 1
      )
  ),
  qs_unis AS (
    SELECT u.country_id, u.id
    FROM public.universities u
    WHERE EXISTS (
      SELECT 1 FROM public.program_draft pd
      WHERE pd.university_id = u.id
        AND pd.schema_version = 'qs_bridge_v1'
        AND pd.review_status IS DISTINCT FROM 'published'
      LIMIT 1
    )
    AND (v_search IS NULL OR v_search = '' OR u.name ILIKE '%' || v_search || '%' OR u.name_en ILIKE '%' || v_search || '%')
  ),
  all_unis AS (
    SELECT country_id, id FROM door2_unis
    UNION
    SELECT country_id, id FROM qs_unis
  ),
  country_counts AS (
    SELECT c.id AS country_id, c.country_code, c.name_ar, c.name_en,
      count(DISTINCT f.id) AS university_count
    FROM all_unis f
    JOIN public.countries c ON c.id = f.country_id
    GROUP BY c.id, c.country_code, c.name_ar, c.name_en
    ORDER BY count(DISTINCT f.id) DESC
  )
  SELECT jsonb_build_object(
    'counters', v_counters,
    'countries', COALESCE(jsonb_agg(row_to_json(cc)::jsonb), '[]'::jsonb)
  ) INTO v_result
  FROM country_counts cc;

  RETURN COALESCE(v_result, jsonb_build_object('counters', v_counters, 'countries', '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_admin_door2_unpublished_draft_ids(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS TABLE(id bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id text;
  v_time_window text;
  v_interval interval;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_run_id := p_filters->>'run_id';
  v_time_window := COALESCE(p_filters->>'time_window', '24h');

  v_interval := CASE v_time_window
    WHEN '15m' THEN interval '15 minutes'
    WHEN '1h'  THEN interval '1 hour'
    WHEN '6h'  THEN interval '6 hours'
    WHEN '24h' THEN interval '24 hours'
    ELSE NULL
  END;

  RETURN QUERY
  SELECT pd.id
  FROM public.program_draft pd
  JOIN public.uniranks_crawl_state cs ON cs.university_id = pd.university_id::text
  WHERE pd.schema_version = 'door2-detail-v1'
    AND pd.review_status IS DISTINCT FROM 'published'
    AND pd.source_url IS NOT NULL
    AND pd.source_url <> ''
    AND pd.source_url NOT LIKE '%#%'
    AND (v_interval IS NULL OR cs.updated_at >= now() - v_interval)
    AND (v_run_id IS NULL OR cs.door2_run_id = v_run_id)

  UNION ALL

  SELECT pd.id
  FROM public.program_draft pd
  WHERE pd.schema_version = 'qs_bridge_v1'
    AND pd.review_status IS DISTINCT FROM 'published'
    AND pd.source_url IS NOT NULL
    AND pd.source_url <> ''

  ORDER BY 1;
END;
$$;
