-- Fix type mismatch: uniranks_crawl_state.university_id is text, universities.id is uuid
DROP FUNCTION IF EXISTS public.rpc_admin_door2_review_countries(jsonb);

CREATE OR REPLACE FUNCTION public.rpc_admin_door2_review_countries(
  p_filters jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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

  -- Counters
  SELECT jsonb_build_object(
    'processed_15m', (SELECT count(*) FROM uniranks_crawl_state WHERE updated_at >= now() - interval '15 minutes' AND (v_run_id IS NULL OR door2_run_id = v_run_id)),
    'errors_15m', (SELECT count(*) FROM uniranks_crawl_state WHERE quarantine_reason IS NOT NULL AND quarantined_at >= now() - interval '15 minutes' AND (v_run_id IS NULL OR door2_run_id = v_run_id)),
    'pending_total', (SELECT count(*) FROM uniranks_crawl_state WHERE stage IN ('profile_pending','programs_pending') AND (v_run_id IS NULL OR door2_run_id = v_run_id))
  ) INTO v_counters;

  -- Countries
  WITH filtered AS (
    SELECT u.country_id, u.id
    FROM universities u
    JOIN uniranks_crawl_state cs ON cs.university_id = u.id::text
    WHERE
      (v_run_id IS NULL OR cs.door2_run_id = v_run_id)
      AND (v_stage IS NULL OR v_stage = '' OR cs.stage = v_stage)
      AND (v_interval IS NULL OR cs.updated_at >= now() - v_interval)
      AND (v_search IS NULL OR v_search = '' OR u.name ILIKE '%' || v_search || '%' OR u.name_en ILIKE '%' || v_search || '%')
  ),
  country_counts AS (
    SELECT
      c.id AS country_id,
      c.country_code,
      c.name_ar,
      c.name_en,
      count(f.id) AS university_count
    FROM filtered f
    JOIN countries c ON c.id = f.country_id
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

-- Also fix the same issue in rpc_admin_door2_review_queue
DROP FUNCTION IF EXISTS public.rpc_admin_door2_review_queue(jsonb, integer, integer);

CREATE OR REPLACE FUNCTION public.rpc_admin_door2_review_queue(
  p_filters jsonb DEFAULT '{}'::jsonb,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_stage text;
  v_time_window text;
  v_search text;
  v_country text;
  v_run_id text;
  v_interval interval;
  v_offset integer;
  v_result jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_stage := p_filters->>'stage';
  v_time_window := p_filters->>'time_window';
  v_search := p_filters->>'search';
  v_country := p_filters->>'country_code';
  v_run_id := p_filters->>'run_id';
  v_offset := (p_page - 1) * p_page_size;

  v_interval := CASE v_time_window
    WHEN '15m' THEN interval '15 minutes'
    WHEN '1h'  THEN interval '1 hour'
    WHEN '6h'  THEN interval '6 hours'
    WHEN '24h' THEN interval '24 hours'
    ELSE NULL
  END;

  WITH filtered AS (
    SELECT
      u.id AS university_id,
      u.name,
      u.name_en,
      u.slug,
      u.website,
      u.logo_url,
      u.uniranks_rank,
      cs.stage,
      cs.updated_at AS state_updated_at,
      cs.retry_count,
      cs.quarantine_reason,
      cs.door2_run_id,
      c.country_code,
      c.name_en AS country_name_en,
      c.name_ar AS country_name_ar,
      -- Latest step statuses via LATERAL
      about_step.status AS about_status,
      logo_step.status AS logo_status,
      profile_step.status AS profile_main_status,
      programs_step.status AS programs_list_status,
      programs_step.links_found AS links_found
    FROM universities u
    JOIN uniranks_crawl_state cs ON cs.university_id = u.id::text
    LEFT JOIN countries c ON c.id = u.country_id
    LEFT JOIN LATERAL (
      SELECT sr.status FROM uniranks_step_runs sr
      WHERE sr.university_id = u.id::text AND sr.step_name = 'about'
      ORDER BY sr.started_at DESC LIMIT 1
    ) about_step ON true
    LEFT JOIN LATERAL (
      SELECT sr.status FROM uniranks_step_runs sr
      WHERE sr.university_id = u.id::text AND sr.step_name = 'logo'
      ORDER BY sr.started_at DESC LIMIT 1
    ) logo_step ON true
    LEFT JOIN LATERAL (
      SELECT sr.status FROM uniranks_step_runs sr
      WHERE sr.university_id = u.id::text AND sr.step_name = 'profile_main'
      ORDER BY sr.started_at DESC LIMIT 1
    ) profile_step ON true
    LEFT JOIN LATERAL (
      SELECT sr.status, sr.links_found FROM uniranks_step_runs sr
      WHERE sr.university_id = u.id::text AND sr.step_name = 'programs_list'
      ORDER BY sr.started_at DESC LIMIT 1
    ) programs_step ON true
    WHERE
      (v_run_id IS NULL OR cs.door2_run_id = v_run_id)
      AND (v_stage IS NULL OR v_stage = '' OR cs.stage = v_stage)
      AND (v_interval IS NULL OR cs.updated_at >= now() - v_interval)
      AND (v_search IS NULL OR v_search = '' OR u.name ILIKE '%' || v_search || '%' OR u.name_en ILIKE '%' || v_search || '%')
      AND (v_country IS NULL OR v_country = '' OR c.country_code = v_country)
    ORDER BY u.uniranks_rank ASC NULLS LAST
    LIMIT p_page_size OFFSET v_offset
  )
  SELECT COALESCE(jsonb_agg(row_to_json(f)::jsonb), '[]'::jsonb)
  INTO v_result
  FROM filtered f;

  RETURN v_result;
END;
$$;

-- Also fix rpc_admin_door2_list_runs
DROP FUNCTION IF EXISTS public.rpc_admin_door2_list_runs();

CREATE OR REPLACE FUNCTION public.rpc_admin_door2_list_runs()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb ORDER BY r.started_at DESC), '[]'::jsonb)
    FROM (
      SELECT
        door2_run_id AS run_id,
        min(created_at) AS started_at,
        max(updated_at) AS last_activity,
        count(*) AS university_count,
        count(*) FILTER (WHERE stage = 'done') AS done_count,
        count(*) FILTER (WHERE quarantine_reason IS NOT NULL) AS error_count
      FROM uniranks_crawl_state
      WHERE door2_run_id IS NOT NULL
      GROUP BY door2_run_id
    ) r
  );
END;
$$;

NOTIFY pgrst, 'reload schema';