CREATE OR REPLACE FUNCTION public.rpc_publish_program_batch(p_batch_id UUID)
RETURNS TABLE(published_count INT, skipped_count INT, error_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_published INT := 0; v_skipped INT := 0; v_errors INT := 0; rec RECORD;
  v_degree_id UUID; v_discipline_id UUID;
  v_intake_months TEXT[];
  v_next_intake DATE;
  v_languages TEXT[];
BEGIN
  FOR rec IN 
    SELECT pd.* FROM program_draft pd 
    WHERE pd.batch_id = p_batch_id 
      AND pd.status IN ('verified', 'extracted')
  LOOP
    BEGIN
      -- Map degree_level text to degree_id
      SELECT d.id INTO v_degree_id FROM degrees d 
      WHERE d.slug = LOWER(COALESCE(rec.degree_level, ''))
      LIMIT 1;
      IF v_degree_id IS NULL THEN
        SELECT d.id INTO v_degree_id FROM degrees d 
        WHERE LOWER(COALESCE(rec.degree_level, '')) LIKE '%' || d.slug || '%'
        LIMIT 1;
      END IF;

      -- Map discipline
      v_discipline_id := NULL;
      SELECT d.id INTO v_discipline_id FROM disciplines d
      WHERE d.slug = LOWER(COALESCE(rec.extracted_json->>'discipline_hint', ''))
      LIMIT 1;
      IF v_discipline_id IS NULL AND rec.extracted_json->>'discipline_hint' IS NOT NULL THEN
        SELECT d.id INTO v_discipline_id FROM disciplines d
        WHERE LOWER(COALESCE(rec.extracted_json->>'discipline_hint', '')) LIKE '%' || d.slug || '%'
           OR d.slug LIKE '%' || LOWER(SPLIT_PART(COALESCE(rec.extracted_json->>'discipline_hint', ''), ',', 1)) || '%'
        LIMIT 1;
      END IF;

      -- Compute intake_months as TEXT[] from rec.intake_months (INT[])
      IF rec.intake_months IS NOT NULL AND array_length(rec.intake_months, 1) > 0 THEN
        v_intake_months := ARRAY(SELECT m::TEXT FROM unnest(rec.intake_months) AS m);
      ELSE
        v_intake_months := ARRAY['8'];
      END IF;
      
      -- Compute next intake date
      v_next_intake := NULL;
      IF rec.intake_months IS NOT NULL AND array_length(rec.intake_months, 1) > 0 THEN
        DECLARE m INT; today DATE := CURRENT_DATE;
        BEGIN
          FOREACH m IN ARRAY rec.intake_months LOOP
            IF make_date(EXTRACT(YEAR FROM today)::INT, m, 1) > today THEN
              v_next_intake := make_date(EXTRACT(YEAR FROM today)::INT, m, 1);
              EXIT;
            END IF;
          END LOOP;
          IF v_next_intake IS NULL THEN
            v_next_intake := make_date(EXTRACT(YEAR FROM today)::INT + 1, rec.intake_months[1], 1);
          END IF;
        END;
      ELSE
        v_next_intake := make_date(EXTRACT(YEAR FROM CURRENT_DATE)::INT + 1, 8, 1);
      END IF;

      -- Languages
      v_languages := COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(rec.extracted_json->'languages')),
        ARRAY['EN']
      );
      IF array_length(v_languages, 1) IS NULL OR array_length(v_languages, 1) = 0 THEN
        v_languages := ARRAY['EN'];
      END IF;

      INSERT INTO programs (
        university_id, title, degree_level, degree_id, discipline_id, duration_months,
        tuition_usd_min, tuition_usd_max, tuition_basis, tuition_scope,
        languages, study_mode, intake_months, next_intake_date, city,
        source_program_url, content_hash, fingerprint,
        publish_status, is_active, published
      ) VALUES (
        rec.university_id, rec.title, rec.degree_level, v_degree_id, v_discipline_id, rec.duration_months,
        (rec.extracted_json->'tuition'->>'usd_min')::NUMERIC,
        (rec.extracted_json->'tuition'->>'usd_max')::NUMERIC,
        rec.extracted_json->'tuition'->>'basis',
        rec.extracted_json->'tuition'->>'scope',
        v_languages,
        COALESCE(rec.extracted_json->>'study_mode', 'on_campus'),
        v_intake_months,
        v_next_intake,
        (SELECT u.city FROM universities u WHERE u.id = rec.university_id),
        rec.source_program_url, rec.content_hash, rec.program_key,
        'published', true, true
      ) ON CONFLICT (fingerprint) WHERE fingerprint IS NOT NULL
      DO UPDATE SET title = EXCLUDED.title, degree_level = EXCLUDED.degree_level,
        degree_id = EXCLUDED.degree_id, discipline_id = EXCLUDED.discipline_id,
        duration_months = EXCLUDED.duration_months, tuition_usd_min = EXCLUDED.tuition_usd_min,
        tuition_usd_max = EXCLUDED.tuition_usd_max, tuition_basis = EXCLUDED.tuition_basis,
        tuition_scope = EXCLUDED.tuition_scope, languages = EXCLUDED.languages,
        study_mode = EXCLUDED.study_mode, intake_months = EXCLUDED.intake_months,
        next_intake_date = EXCLUDED.next_intake_date,
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