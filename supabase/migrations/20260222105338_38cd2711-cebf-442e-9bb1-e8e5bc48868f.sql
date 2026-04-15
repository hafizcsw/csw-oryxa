
CREATE OR REPLACE FUNCTION public.rpc_admin_door2_review_countries(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '25s'
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
    ELSE interval '24 hours'  -- default to 24h instead of NULL (all)
  END;

  -- Lightweight counters: avoid joining with the heavy view
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
      SELECT count(*) FROM public.uniranks_crawl_state cs
      WHERE cs.stage IN ('profile_pending','programs_pending')
        AND (v_run_id IS NULL OR cs.door2_run_id = v_run_id)
    )
  ) INTO v_counters;

  -- Countries list: join crawl_state with universities directly,
  -- only include universities that have at least one draft
  WITH filtered AS (
    SELECT u.country_id, u.id
    FROM public.universities u
    JOIN public.uniranks_crawl_state cs ON cs.university_id = u.id::text
    WHERE
      (v_run_id IS NULL OR cs.door2_run_id = v_run_id)
      AND (v_stage IS NULL OR v_stage = '' OR cs.stage = v_stage)
      AND cs.updated_at >= now() - v_interval
      AND (v_search IS NULL OR v_search = '' OR u.name ILIKE '%' || v_search || '%' OR u.name_en ILIKE '%' || v_search || '%')
      AND cs.stage = 'done'
      AND EXISTS (
        SELECT 1 FROM public.program_draft pd
        WHERE pd.university_id = u.id
          AND pd.schema_version = 'door2-detail-v1'
        LIMIT 1
      )
  ),
  country_counts AS (
    SELECT c.id AS country_id, c.country_code, c.name_ar, c.name_en,
      count(f.id) AS university_count
    FROM filtered f
    JOIN public.countries c ON c.id = f.country_id
    GROUP BY c.id, c.country_code, c.name_ar, c.name_en
    ORDER BY count(f.id) DESC
  )
  SELECT jsonb_build_object(
    'counters', v_counters,
    'countries', COALESCE(jsonb_agg(row_to_json(cc)::jsonb), '[]'::jsonb)
  ) INTO v_result
  FROM country_counts cc;

  RETURN COALESCE(v_result, jsonb_build_object('counters', v_counters, 'countries', '[]'::jsonb));
END;
$$;
