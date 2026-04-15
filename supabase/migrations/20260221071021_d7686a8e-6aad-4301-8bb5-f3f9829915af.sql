
CREATE OR REPLACE FUNCTION public.rpc_admin_door2_unpublished_draft_ids(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS TABLE(id bigint) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id text;
  v_search text;
  v_stage text;
  v_time_window text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_run_id := p_filters->>'run_id';
  v_search := p_filters->>'search';
  v_stage := p_filters->>'stage';
  v_time_window := p_filters->>'time_window';

  RETURN QUERY
  SELECT pd.id
  FROM program_draft pd
  JOIN uniranks_crawl_state ucs ON ucs.university_id = pd.university_id::text
  WHERE pd.review_status IS DISTINCT FROM 'published'
    AND pd.schema_version = 'door2-detail-v1'
    AND (v_run_id IS NULL OR ucs.door2_run_id = v_run_id)
    AND (v_stage IS NULL OR ucs.stage = v_stage)
    AND (v_search IS NULL OR pd.title ILIKE '%' || v_search || '%')
    AND (v_time_window IS NULL OR pd.created_at >= now() - (v_time_window || ' hours')::interval);
END;
$$;
