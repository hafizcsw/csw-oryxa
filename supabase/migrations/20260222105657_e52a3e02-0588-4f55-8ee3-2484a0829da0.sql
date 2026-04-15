
CREATE OR REPLACE FUNCTION public.rpc_admin_door2_unpublished_draft_ids(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS TABLE(id bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '25s'
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
    ELSE interval '24 hours'
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
    AND cs.updated_at >= now() - v_interval
    AND (v_run_id IS NULL OR cs.door2_run_id = v_run_id)
  ORDER BY pd.id;
END;
$$;
