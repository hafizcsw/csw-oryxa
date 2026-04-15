
-- 1) Add door2_run_id column
ALTER TABLE public.uniranks_crawl_state 
  ADD COLUMN IF NOT EXISTS door2_run_id text;

CREATE INDEX IF NOT EXISTS idx_crawl_state_run_id ON public.uniranks_crawl_state(door2_run_id);

-- 2) Drop and recreate rpc_admin_door2_review_countries with run_id support
DROP FUNCTION IF EXISTS public.rpc_admin_door2_review_countries(jsonb);

CREATE OR REPLACE FUNCTION public.rpc_admin_door2_review_countries(
  p_filters jsonb DEFAULT '{}'::jsonb
)
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
    JOIN uniranks_crawl_state cs ON cs.university_id = u.id
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

-- 3) Drop and recreate rpc_admin_door2_review_queue with run_id support
DROP FUNCTION IF EXISTS public.rpc_admin_door2_review_queue(jsonb, int, int);

CREATE OR REPLACE FUNCTION public.rpc_admin_door2_review_queue(
  p_filters jsonb DEFAULT '{}'::jsonb,
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage text;
  v_time_window text;
  v_search text;
  v_country_code text;
  v_run_id text;
  v_interval interval;
  v_offset int;
  v_total int;
  v_rows jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_stage := p_filters->>'stage';
  v_time_window := p_filters->>'time_window';
  v_search := p_filters->>'search';
  v_country_code := p_filters->>'country_code';
  v_run_id := p_filters->>'run_id';
  v_offset := (p_page - 1) * p_page_size;

  v_interval := CASE v_time_window
    WHEN '15m' THEN interval '15 minutes'
    WHEN '1h'  THEN interval '1 hour'
    WHEN '6h'  THEN interval '6 hours'
    WHEN '24h' THEN interval '24 hours'
    ELSE NULL
  END;

  -- Count
  SELECT count(*) INTO v_total
  FROM universities u
  JOIN uniranks_crawl_state cs ON cs.university_id = u.id
  JOIN countries co ON co.id = u.country_id
  WHERE
    (v_run_id IS NULL OR cs.door2_run_id = v_run_id)
    AND (v_country_code IS NULL OR v_country_code = '' OR co.country_code = v_country_code)
    AND (v_stage IS NULL OR v_stage = '' OR cs.stage = v_stage)
    AND (v_interval IS NULL OR cs.updated_at >= now() - v_interval)
    AND (v_search IS NULL OR v_search = '' OR u.name ILIKE '%' || v_search || '%' OR u.name_en ILIKE '%' || v_search || '%');

  -- Rows
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
      cs.retry_count AS door2_retries,
      cs.quarantine_reason AS door2_quarantine,
      cs.door2_run_id,
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
    JOIN uniranks_crawl_state cs ON cs.university_id = u.id
    JOIN countries co ON co.id = u.country_id
    LEFT JOIN LATERAL (
      SELECT sr.status FROM uniranks_step_runs sr
      WHERE sr.university_id = u.id AND sr.section = 'about'
      ORDER BY sr.created_at DESC LIMIT 1
    ) sr_about ON true
    LEFT JOIN LATERAL (
      SELECT sr.status FROM uniranks_step_runs sr
      WHERE sr.university_id = u.id AND sr.section = 'logo'
      ORDER BY sr.created_at DESC LIMIT 1
    ) sr_logo ON true
    LEFT JOIN LATERAL (
      SELECT sr.status FROM uniranks_step_runs sr
      WHERE sr.university_id = u.id AND sr.section = 'profile_main'
      ORDER BY sr.created_at DESC LIMIT 1
    ) sr_profile ON true
    LEFT JOIN LATERAL (
      SELECT sr.status, sr.details_json FROM uniranks_step_runs sr
      WHERE sr.university_id = u.id AND sr.section = 'programs_list'
      ORDER BY sr.created_at DESC LIMIT 1
    ) sr_programs ON true
    WHERE
      (v_run_id IS NULL OR cs.door2_run_id = v_run_id)
      AND (v_country_code IS NULL OR v_country_code = '' OR co.country_code = v_country_code)
      AND (v_stage IS NULL OR v_stage = '' OR cs.stage = v_stage)
      AND (v_interval IS NULL OR cs.updated_at >= now() - v_interval)
      AND (v_search IS NULL OR v_search = '' OR u.name ILIKE '%' || v_search || '%' OR u.name_en ILIKE '%' || v_search || '%')
    ORDER BY u.uniranks_rank ASC NULLS LAST
    LIMIT p_page_size OFFSET v_offset
  )
  SELECT COALESCE(jsonb_agg(row_to_json(unis)::jsonb), '[]'::jsonb) INTO v_rows FROM unis;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

-- 4) Create helper to list available runs
CREATE OR REPLACE FUNCTION public.rpc_admin_door2_list_runs()
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

  SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb ORDER BY r.started_at DESC), '[]'::jsonb)
  INTO v_result
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
  ) r;

  RETURN v_result;
END;
$$;

NOTIFY pgrst, 'reload schema';
