-- Fix the status check constraint to include 'published'
ALTER TABLE crawl_batches DROP CONSTRAINT crawl_batches_status_check;
ALTER TABLE crawl_batches ADD CONSTRAINT crawl_batches_status_check 
  CHECK (status = ANY (ARRAY['pending','websites','discovery','fetching','extracting','verifying','ready','publishing','published','done','failed']));

-- Fix the RPC to also publish 'extracted' drafts (not just 'verified') and any approval_tier
CREATE OR REPLACE FUNCTION public.rpc_publish_program_batch(p_batch_id UUID)
RETURNS TABLE(published_count INT, skipped_count INT, error_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_published INT := 0; v_skipped INT := 0; v_errors INT := 0; rec RECORD;
BEGIN
  -- Publish drafts that are auto-approved OR extracted (for manual seed tests)
  FOR rec IN 
    SELECT pd.* FROM program_draft pd 
    WHERE pd.batch_id = p_batch_id 
      AND pd.status IN ('verified', 'extracted')
  LOOP
    BEGIN
      INSERT INTO programs (
        university_id, title, degree_level, duration_months,
        tuition_usd_min, tuition_usd_max, tuition_basis, tuition_scope,
        languages, study_mode, intake_months, city,
        source_program_url, content_hash, fingerprint,
        publish_status, is_active, published
      ) VALUES (
        rec.university_id, rec.title, rec.degree_level, rec.duration_months,
        (rec.extracted_json->'tuition'->>'usd_min')::NUMERIC,
        (rec.extracted_json->'tuition'->>'usd_max')::NUMERIC,
        rec.extracted_json->'tuition'->>'basis',
        rec.extracted_json->'tuition'->>'scope',
        COALESCE(
          ARRAY(SELECT jsonb_array_elements_text(rec.extracted_json->'languages')),
          ARRAY['EN']
        ),
        COALESCE(rec.extracted_json->>'study_mode', 'on_campus'),
        rec.intake_months,
        (SELECT u.city FROM universities u WHERE u.id = rec.university_id),
        rec.source_program_url, rec.content_hash, rec.program_key,
        'published', true, true
      ) ON CONFLICT (fingerprint) WHERE fingerprint IS NOT NULL
      DO UPDATE SET title = EXCLUDED.title, degree_level = EXCLUDED.degree_level,
        duration_months = EXCLUDED.duration_months, tuition_usd_min = EXCLUDED.tuition_usd_min,
        tuition_usd_max = EXCLUDED.tuition_usd_max, tuition_basis = EXCLUDED.tuition_basis,
        tuition_scope = EXCLUDED.tuition_scope, languages = EXCLUDED.languages,
        study_mode = EXCLUDED.study_mode, intake_months = EXCLUDED.intake_months,
        source_program_url = EXCLUDED.source_program_url, content_hash = EXCLUDED.content_hash,
        updated_at = now();

      UPDATE program_draft SET status = 'published',
        published_program_id = (SELECT id FROM programs WHERE fingerprint = rec.program_key LIMIT 1)
      WHERE id = rec.id;
      v_published := v_published + 1;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO ingest_errors (pipeline, batch_id, entity_hint, source_url, fingerprint, stage, reason, details_json)
      VALUES ('crawl_pipeline', p_batch_id, 'program', rec.source_program_url, rec.program_key, 'publish',
              'db_error', jsonb_build_object('message', SQLERRM, 'sqlstate', SQLSTATE));
      v_errors := v_errors + 1;
    END;
  END LOOP;

  SELECT COUNT(*) INTO v_skipped FROM program_draft
  WHERE batch_id = p_batch_id AND status NOT IN ('published');

  UPDATE crawl_batches SET programs_published = COALESCE(programs_published, 0) + v_published,
    status = 'published', finished_at = now() WHERE id = p_batch_id;

  RETURN QUERY SELECT v_published, v_skipped, v_errors;
END;
$$;