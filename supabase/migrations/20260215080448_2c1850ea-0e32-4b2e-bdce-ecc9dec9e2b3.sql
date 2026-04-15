
-- ============================================================
-- TWO LANES: Search Publish RPC (tier-filtered, gate-enforced)
-- ============================================================
-- Lane 2: Only publishes auto-tier verified drafts as truly published programs
-- Enforces: approval_tier='auto', status='verified', all mandatory fields present
-- Result: publish_status='published', published=true → visible in search views

CREATE OR REPLACE FUNCTION public.rpc_publish_program_batch_search(p_batch_id UUID)
RETURNS TABLE(published_count INT, skipped_count INT, error_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_published INT := 0;
  v_skipped INT := 0;
  v_errors INT := 0;
  rec RECORD;
  v_degree_id UUID;
  v_discipline_id UUID;
  v_intake_months TEXT[];
  v_next_intake DATE;
  v_languages TEXT[];
  v_currency TEXT;
  v_tuition_basis TEXT;
  v_tuition_scope TEXT;
  v_tuition_usd_min NUMERIC;
  v_tuition_usd_max NUMERIC;
BEGIN
  FOR rec IN
    SELECT pd.* FROM program_draft pd
    WHERE pd.batch_id = p_batch_id
      AND pd.status = 'verified'
      AND pd.approval_tier = 'auto'
  LOOP
    BEGIN
      -- ====== GATE CHECK: Reject if missing mandatory fields ======
      IF rec.title IS NULL OR rec.degree_level IS NULL OR rec.duration_months IS NULL THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      -- Map degree_level text to degree_id
      SELECT d.id INTO v_degree_id FROM degrees d
      WHERE d.slug = LOWER(COALESCE(rec.degree_level, ''))
      LIMIT 1;
      IF v_degree_id IS NULL THEN
        SELECT d.id INTO v_degree_id FROM degrees d
        WHERE LOWER(COALESCE(rec.degree_level, '')) LIKE '%' || d.slug || '%'
        LIMIT 1;
      END IF;

      -- Gate: degree_id is mandatory for search
      IF v_degree_id IS NULL THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
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

      -- Tuition validation
      v_tuition_basis := rec.extracted_json->'tuition'->>'basis';
      v_tuition_scope := rec.extracted_json->'tuition'->>'scope';
      v_tuition_usd_min := (rec.extracted_json->'tuition'->>'usd_min')::NUMERIC;
      v_tuition_usd_max := (rec.extracted_json->'tuition'->>'usd_max')::NUMERIC;

      -- Gate: For non-free programs, require valid tuition
      IF NOT COALESCE((rec.extracted_json->'tuition'->>'is_free')::BOOLEAN, false) THEN
        IF v_tuition_basis IS NULL OR v_tuition_basis = 'unknown'
           OR v_tuition_scope IS NULL OR v_tuition_scope = 'unknown'
           OR v_tuition_usd_min IS NULL THEN
          v_skipped := v_skipped + 1;
          CONTINUE;
        END IF;
      END IF;

      -- Compute intake_months as TEXT[]
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

      -- Languages (must have at least one)
      v_languages := COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(rec.extracted_json->'languages')),
        ARRAY['EN']
      );
      IF array_length(v_languages, 1) IS NULL OR array_length(v_languages, 1) = 0 THEN
        v_languages := ARRAY['EN'];
      END IF;

      -- Currency
      v_currency := COALESCE(rec.extracted_json->'tuition'->>'currency', rec.currency, 'USD');

      -- ====== INSERT as PUBLISHED (Search-ready) ======
      INSERT INTO programs (
        university_id, title, degree_level, degree_id, discipline_id, duration_months,
        tuition_usd_min, tuition_usd_max, tuition_basis, tuition_scope,
        tuition_local_min, tuition_local_max, currency_code,
        languages, study_mode, intake_months, next_intake_date, city,
        source_program_url, content_hash, fingerprint,
        publish_status, is_active, published
      ) VALUES (
        rec.university_id, rec.title, rec.degree_level, v_degree_id, v_discipline_id, rec.duration_months,
        v_tuition_usd_min,
        COALESCE(v_tuition_usd_max, v_tuition_usd_min),
        v_tuition_basis,
        v_tuition_scope,
        v_tuition_usd_min,
        COALESCE(v_tuition_usd_max, v_tuition_usd_min),
        v_currency,
        v_languages,
        COALESCE(rec.extracted_json->>'study_mode', 'on_campus'),
        v_intake_months,
        v_next_intake,
        (SELECT u.city FROM universities u WHERE u.id = rec.university_id),
        rec.source_program_url, rec.content_hash, rec.program_key,
        'published', true, true
      ) ON CONFLICT (fingerprint) WHERE fingerprint IS NOT NULL
      DO UPDATE SET
        title = EXCLUDED.title, degree_level = EXCLUDED.degree_level,
        degree_id = EXCLUDED.degree_id, discipline_id = EXCLUDED.discipline_id,
        duration_months = EXCLUDED.duration_months,
        tuition_usd_min = EXCLUDED.tuition_usd_min, tuition_usd_max = EXCLUDED.tuition_usd_max,
        tuition_basis = EXCLUDED.tuition_basis, tuition_scope = EXCLUDED.tuition_scope,
        tuition_local_min = EXCLUDED.tuition_local_min, tuition_local_max = EXCLUDED.tuition_local_max,
        currency_code = EXCLUDED.currency_code,
        languages = EXCLUDED.languages, study_mode = EXCLUDED.study_mode,
        intake_months = EXCLUDED.intake_months, next_intake_date = EXCLUDED.next_intake_date,
        source_program_url = EXCLUDED.source_program_url, content_hash = EXCLUDED.content_hash,
        publish_status = 'published', published = true,
        updated_at = now();

      -- Mark draft as published
      UPDATE program_draft SET
        status = 'published',
        published_program_id = (SELECT id FROM programs WHERE fingerprint = rec.program_key LIMIT 1)
      WHERE id = rec.id;

      v_published := v_published + 1;

    EXCEPTION WHEN OTHERS THEN
      INSERT INTO ingest_errors (pipeline, batch_id, entity_hint, source_url, fingerprint, stage, reason, details_json)
      VALUES ('crawl_pipeline', p_batch_id, 'program', rec.source_program_url, rec.program_key, 'search_publish',
              'db_error', jsonb_build_object('message', SQLERRM, 'sqlstate', SQLSTATE));
      v_errors := v_errors + 1;
    END;
  END LOOP;

  -- Count skipped = all non-published drafts in this batch
  SELECT COUNT(*) INTO v_skipped FROM program_draft
  WHERE batch_id = p_batch_id AND status NOT IN ('published');

  -- Update batch
  UPDATE crawl_batches SET
    programs_published = COALESCE(programs_published, 0) + v_published,
    status = 'published',
    finished_at = now()
  WHERE id = p_batch_id;

  RETURN QUERY SELECT v_published, v_skipped, v_errors;
END;
$$;

-- Security: service_role only
REVOKE ALL ON FUNCTION public.rpc_publish_program_batch_search(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_publish_program_batch_search(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.rpc_publish_program_batch_search(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_publish_program_batch_search(UUID) TO service_role;

-- Also lock down the harvest-lane RPC (already exists but re-confirm)
REVOKE ALL ON FUNCTION public.rpc_publish_program_batch(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_publish_program_batch(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.rpc_publish_program_batch(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_publish_program_batch(UUID) TO service_role;
