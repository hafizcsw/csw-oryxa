CREATE OR REPLACE FUNCTION rpc_we_pick_batch(p_job_id uuid, p_batch_size int DEFAULT 5000)
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
  v_null_name_count int;
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
    SELECT u.id, COALESCE(u.name_en, u.name) AS resolved_name, u.country_code, u.city
    FROM universities u
    WHERE u.is_active = true
      AND (u.website IS NULL OR u.website = '')
      AND COALESCE(u.name_en, u.name) IS NOT NULL
      AND COALESCE(u.name_en, u.name) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM website_enrichment_rows r
        WHERE r.university_id = u.id AND r.job_id = p_job_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM university_duplicates ud
        WHERE ud.duplicate_university_id = u.id
      )
      AND (v_filter->>'country_code' IS NULL OR u.country_code = v_filter->>'country_code')
      AND (v_filter->>'name_contains' IS NULL OR COALESCE(u.name_en, u.name) ILIKE '%' || (v_filter->>'name_contains') || '%')
    ORDER BY u.ranking NULLS LAST, COALESCE(u.name_en, u.name)
    LIMIT v_effective_limit
  )
  INSERT INTO website_enrichment_rows (job_id, university_id, university_name, country_code, city)
  SELECT p_job_id, c.id, c.resolved_name, c.country_code, c.city
  FROM candidates c
  ON CONFLICT (job_id, university_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  SELECT COUNT(*) INTO v_null_name_count
  FROM website_enrichment_rows
  WHERE job_id = p_job_id AND (university_name IS NULL OR university_name = '');

  IF v_null_name_count > 0 THEN
    DELETE FROM website_enrichment_rows
    WHERE job_id = p_job_id AND (university_name IS NULL OR university_name = '');
    v_inserted := v_inserted - v_null_name_count;
  END IF;

  UPDATE website_enrichment_jobs
  SET last_activity_at = now()
  WHERE id = p_job_id;

  RETURN v_inserted;
END;
$$;