DROP FUNCTION IF EXISTS public.rpc_we_pick_batch(uuid, integer);

CREATE FUNCTION public.rpc_we_pick_batch(p_job_id uuid, p_batch_size int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_filter jsonb;
  v_max_rows int;
  v_current_count int;
  v_effective_limit int;
  v_inserted int;
BEGIN
  SELECT filter_criteria INTO v_filter
  FROM website_enrichment_jobs
  WHERE id = p_job_id AND status IN ('queued','running');
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  v_max_rows := (v_filter->>'max_rows')::int;
  
  IF v_max_rows IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_count
    FROM website_enrichment_rows WHERE job_id = p_job_id;
    
    IF v_current_count >= v_max_rows THEN
      RETURN 0;
    END IF;
    
    v_effective_limit := LEAST(p_batch_size, v_max_rows - v_current_count);
  ELSE
    v_effective_limit := p_batch_size;
  END IF;
  
  WITH candidates AS (
    SELECT u.id, u.name_en, u.country_code, u.city
    FROM universities u
    WHERE u.website IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM website_enrichment_rows r
        WHERE r.university_id = u.id AND r.job_id = p_job_id
      )
      AND (v_filter->>'country_code' IS NULL OR u.country_code = v_filter->>'country_code')
      AND (v_filter->>'name_contains' IS NULL OR u.name_en ILIKE '%' || (v_filter->>'name_contains') || '%')
    ORDER BY u.ranking NULLS LAST, u.name_en
    LIMIT v_effective_limit
  )
  INSERT INTO website_enrichment_rows (job_id, university_id, university_name, country_code, city)
  SELECT p_job_id, c.id, c.name_en, c.country_code, c.city
  FROM candidates c
  ON CONFLICT (job_id, university_id) DO NOTHING;
  
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  
  UPDATE website_enrichment_jobs
  SET last_activity_at = now()
  WHERE id = p_job_id;
  
  RETURN v_inserted;
END;
$$;