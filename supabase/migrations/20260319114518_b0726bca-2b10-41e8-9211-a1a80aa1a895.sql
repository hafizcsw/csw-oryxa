-- Wire apply_url, ielts, duolingo, pte, cefr into both publish RPCs from extracted_json

-- 1. Patch rpc_publish_program_batch_search (Search Lane)
CREATE OR REPLACE FUNCTION public.rpc_publish_program_batch_search(p_batch_id uuid)
 RETURNS TABLE(published integer, skipped integer, errors integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_program_id UUID;
  v_uni_ready BOOLEAN;
  v_raw_lang TEXT;
  -- NEW: program-level fields
  v_apply_url TEXT;
  v_ielts NUMERIC;
  v_duolingo NUMERIC;
  v_pte NUMERIC;
  v_cefr TEXT;
BEGIN
  FOR rec IN
    SELECT pd.* FROM program_draft pd
    WHERE pd.batch_id = p_batch_id
      AND pd.status = 'verified'
      AND pd.approval_tier = 'auto'
  LOOP
    BEGIN
      IF rec.title IS NULL OR rec.degree_level IS NULL OR rec.duration_months IS NULL THEN
        v_skipped := v_skipped + 1; CONTINUE;
      END IF;

      SELECT d.id INTO v_degree_id FROM degrees d WHERE d.slug = LOWER(COALESCE(rec.degree_level, '')) LIMIT 1;
      IF v_degree_id IS NULL THEN
        SELECT d.id INTO v_degree_id FROM degrees d WHERE LOWER(COALESCE(rec.degree_level, '')) LIKE '%' || d.slug || '%' LIMIT 1;
      END IF;
      IF v_degree_id IS NULL THEN v_skipped := v_skipped + 1; CONTINUE; END IF;

      v_discipline_id := NULL;
      SELECT d.id INTO v_discipline_id FROM disciplines d WHERE d.slug = LOWER(COALESCE(rec.extracted_json->>'discipline_hint', '')) LIMIT 1;
      IF v_discipline_id IS NULL AND rec.extracted_json->>'discipline_hint' IS NOT NULL THEN
        SELECT d.id INTO v_discipline_id FROM disciplines d
        WHERE LOWER(COALESCE(rec.extracted_json->>'discipline_hint', '')) LIKE '%' || d.slug || '%'
           OR d.slug LIKE '%' || LOWER(SPLIT_PART(COALESCE(rec.extracted_json->>'discipline_hint', ''), ',', 1)) || '%'
        LIMIT 1;
      END IF;

      v_tuition_basis := rec.extracted_json->'tuition'->>'basis';
      v_tuition_scope := rec.extracted_json->'tuition'->>'scope';
      v_tuition_usd_min := (rec.extracted_json->'tuition'->>'usd_min')::NUMERIC;
      v_tuition_usd_max := (rec.extracted_json->'tuition'->>'usd_max')::NUMERIC;

      IF NOT COALESCE((rec.extracted_json->'tuition'->>'is_free')::BOOLEAN, false) THEN
        IF v_tuition_basis IS NULL OR v_tuition_basis = 'unknown'
           OR v_tuition_scope IS NULL OR v_tuition_scope = 'unknown'
           OR v_tuition_usd_min IS NULL THEN
          v_skipped := v_skipped + 1; CONTINUE;
        END IF;
      END IF;

      SELECT EXISTS(
        SELECT 1 FROM universities u
        JOIN countries c ON c.id = u.country_id
        WHERE u.id = rec.university_id
          AND u.city IS NOT NULL AND btrim(u.city) <> ''
          AND c.country_code IS NOT NULL
          AND u.monthly_living IS NOT NULL
          AND EXISTS(SELECT 1 FROM csw_university_guidance g WHERE g.university_id = u.id)
      ) INTO v_uni_ready;

      IF NOT v_uni_ready THEN
        v_skipped := v_skipped + 1;
        INSERT INTO ingest_errors (pipeline, batch_id, entity_hint, source_url, fingerprint, stage, reason, details_json)
        VALUES ('crawl_pipeline', p_batch_id, 'program', rec.source_program_url, rec.program_key, 'search_publish',
                'university_not_ready', jsonb_build_object('university_id', rec.university_id));
        CONTINUE;
      END IF;

      v_currency := COALESCE(rec.extracted_json->'tuition'->>'currency', rec.currency, 'USD');
      IF UPPER(v_currency) <> 'USD' AND NOT COALESCE((rec.extracted_json->'tuition'->>'is_free')::BOOLEAN, false) THEN
        IF NOT EXISTS(SELECT 1 FROM fx_rates WHERE currency_code = UPPER(v_currency)) THEN
          v_skipped := v_skipped + 1; CONTINUE;
        END IF;
      END IF;

      IF rec.intake_months IS NOT NULL AND array_length(rec.intake_months, 1) > 0 THEN
        v_intake_months := ARRAY(SELECT m::TEXT FROM unnest(rec.intake_months) AS m);
      ELSE
        v_intake_months := ARRAY['8'];
      END IF;

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

      -- BCP47-lite normalization
      v_languages := ARRAY(
        SELECT CASE
          WHEN position('-' in lang) > 0 THEN
            lower(split_part(lang, '-', 1)) || '-' || upper(split_part(lang, '-', 2))
          ELSE
            lower(lang)
        END
        FROM jsonb_array_elements_text(COALESCE(rec.extracted_json->'languages', '["en"]'::jsonb)) AS lang
      );
      IF array_length(v_languages, 1) IS NULL OR array_length(v_languages, 1) = 0 THEN
        v_languages := ARRAY['en'];
      END IF;

      -- NEW: Extract program-level fields from extracted_json (no university fallback)
      v_apply_url := COALESCE(rec.extracted_json->>'apply_url', rec.extracted_json->>'detail_url', rec.source_program_url);
      v_ielts := (rec.extracted_json->>'ielts_min')::NUMERIC;
      v_duolingo := (rec.extracted_json->>'duolingo_min')::NUMERIC;
      v_pte := (rec.extracted_json->>'pte_min')::NUMERIC;
      v_cefr := rec.extracted_json->>'cefr_level';

      -- STEP 1: Upsert as DRAFT
      INSERT INTO programs (
        university_id, title, degree_level, degree_id, discipline_id, duration_months,
        tuition_usd_min, tuition_usd_max, tuition_basis, tuition_scope,
        tuition_local_min, tuition_local_max, currency_code,
        languages, study_mode, intake_months, next_intake_date, city,
        source_program_url, content_hash, fingerprint,
        apply_url, ielts_required, duolingo_min, pte_min, cefr_level,
        publish_status, is_active, published
      ) VALUES (
        rec.university_id, rec.title, rec.degree_level, v_degree_id, v_discipline_id, rec.duration_months,
        v_tuition_usd_min, COALESCE(v_tuition_usd_max, v_tuition_usd_min),
        v_tuition_basis, v_tuition_scope,
        v_tuition_usd_min, COALESCE(v_tuition_usd_max, v_tuition_usd_min),
        v_currency, v_languages,
        COALESCE(rec.extracted_json->>'study_mode', 'on_campus'),
        v_intake_months, v_next_intake,
        (SELECT u.city FROM universities u WHERE u.id = rec.university_id),
        rec.source_program_url, rec.content_hash, rec.program_key,
        v_apply_url, v_ielts, v_duolingo, v_pte, v_cefr,
        'draft', true, false
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
        apply_url = COALESCE(EXCLUDED.apply_url, programs.apply_url),
        ielts_required = COALESCE(EXCLUDED.ielts_required, programs.ielts_required),
        duolingo_min = COALESCE(EXCLUDED.duolingo_min, programs.duolingo_min),
        pte_min = COALESCE(EXCLUDED.pte_min, programs.pte_min),
        cefr_level = COALESCE(EXCLUDED.cefr_level, programs.cefr_level),
        publish_status = 'draft', published = false,
        updated_at = now();

      SELECT id INTO v_program_id FROM programs WHERE fingerprint = rec.program_key LIMIT 1;
      IF v_program_id IS NULL THEN v_errors := v_errors + 1; CONTINUE; END IF;

      -- STEP 2: Populate program_languages
      DELETE FROM program_languages WHERE program_id = v_program_id;
      INSERT INTO program_languages (program_id, language_code)
      SELECT v_program_id, unnest(v_languages)
      ON CONFLICT DO NOTHING;

      -- STEP 3: Promote to PUBLISHED
      UPDATE programs SET publish_status = 'published', published = true, updated_at = now()
      WHERE id = v_program_id;

      UPDATE program_draft SET status = 'published', published_program_id = v_program_id
      WHERE id = rec.id;

      v_published := v_published + 1;

    EXCEPTION WHEN OTHERS THEN
      INSERT INTO ingest_errors (pipeline, batch_id, entity_hint, source_url, fingerprint, stage, reason, details_json)
      VALUES ('crawl_pipeline', p_batch_id, 'program', rec.source_program_url, rec.program_key, 'search_publish',
              'db_error', jsonb_build_object('message', SQLERRM, 'sqlstate', SQLSTATE));
      v_errors := v_errors + 1;
    END;
  END LOOP;

  SELECT COUNT(*) INTO v_skipped FROM program_draft
  WHERE batch_id = p_batch_id AND status NOT IN ('published');

  UPDATE crawl_batches SET
    programs_published = COALESCE(programs_published, 0) + v_published,
    status = 'published', finished_at = now()
  WHERE id = p_batch_id;

  RETURN QUERY SELECT v_published, v_skipped, v_errors;
END;
$function$;


-- 2. Patch rpc_publish_program_batch (Harvest Lane)
CREATE OR REPLACE FUNCTION public.rpc_publish_program_batch(p_batch_id uuid)
 RETURNS TABLE(published_count integer, skipped_count integer, error_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_published INT := 0; v_skipped INT := 0; v_errors INT := 0; rec RECORD;
  v_degree_id UUID; v_discipline_id UUID;
  v_intake_months TEXT[];
  v_next_intake DATE;
  v_languages TEXT[];
  v_currency TEXT;
  -- NEW: program-level fields
  v_apply_url TEXT;
  v_ielts NUMERIC;
  v_duolingo NUMERIC;
  v_pte NUMERIC;
  v_cefr TEXT;
BEGIN
  FOR rec IN 
    SELECT pd.* FROM program_draft pd 
    WHERE pd.batch_id = p_batch_id 
      AND pd.status IN ('verified', 'extracted')
  LOOP
    BEGIN
      SELECT d.id INTO v_degree_id FROM degrees d 
      WHERE d.slug = LOWER(COALESCE(rec.degree_level, ''))
      LIMIT 1;
      IF v_degree_id IS NULL THEN
        SELECT d.id INTO v_degree_id FROM degrees d 
        WHERE LOWER(COALESCE(rec.degree_level, '')) LIKE '%' || d.slug || '%'
        LIMIT 1;
      END IF;

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

      IF rec.intake_months IS NOT NULL AND array_length(rec.intake_months, 1) > 0 THEN
        v_intake_months := ARRAY(SELECT m::TEXT FROM unnest(rec.intake_months) AS m);
      ELSE
        v_intake_months := ARRAY['8'];
      END IF;
      
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

      v_languages := COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(rec.extracted_json->'languages')),
        ARRAY['EN']
      );
      IF array_length(v_languages, 1) IS NULL OR array_length(v_languages, 1) = 0 THEN
        v_languages := ARRAY['EN'];
      END IF;

      v_currency := COALESCE(rec.extracted_json->'tuition'->>'currency', rec.currency, 'USD');

      -- NEW: Extract program-level fields (no university fallback)
      v_apply_url := COALESCE(rec.extracted_json->>'apply_url', rec.extracted_json->>'detail_url', rec.source_program_url);
      v_ielts := (rec.extracted_json->>'ielts_min')::NUMERIC;
      v_duolingo := (rec.extracted_json->>'duolingo_min')::NUMERIC;
      v_pte := (rec.extracted_json->>'pte_min')::NUMERIC;
      v_cefr := rec.extracted_json->>'cefr_level';

      INSERT INTO programs (
        university_id, title, degree_level, degree_id, discipline_id, duration_months,
        tuition_usd_min, tuition_usd_max, tuition_basis, tuition_scope,
        tuition_local_min, tuition_local_max, currency_code,
        languages, study_mode, intake_months, next_intake_date, city,
        source_program_url, content_hash, fingerprint,
        apply_url, ielts_required, duolingo_min, pte_min, cefr_level,
        publish_status, is_active, published
      ) VALUES (
        rec.university_id, rec.title, rec.degree_level, v_degree_id, v_discipline_id, rec.duration_months,
        (rec.extracted_json->'tuition'->>'usd_min')::NUMERIC,
        (rec.extracted_json->'tuition'->>'usd_max')::NUMERIC,
        rec.extracted_json->'tuition'->>'basis',
        rec.extracted_json->'tuition'->>'scope',
        (rec.extracted_json->'tuition'->>'usd_min')::NUMERIC,
        (rec.extracted_json->'tuition'->>'usd_max')::NUMERIC,
        v_currency,
        v_languages,
        COALESCE(rec.extracted_json->>'study_mode', 'on_campus'),
        v_intake_months,
        v_next_intake,
        (SELECT u.city FROM universities u WHERE u.id = rec.university_id),
        rec.source_program_url, rec.content_hash, rec.program_key,
        v_apply_url, v_ielts, v_duolingo, v_pte, v_cefr,
        'draft', true, false
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
        apply_url = COALESCE(EXCLUDED.apply_url, programs.apply_url),
        ielts_required = COALESCE(EXCLUDED.ielts_required, programs.ielts_required),
        duolingo_min = COALESCE(EXCLUDED.duolingo_min, programs.duolingo_min),
        pte_min = COALESCE(EXCLUDED.pte_min, programs.pte_min),
        cefr_level = COALESCE(EXCLUDED.cefr_level, programs.cefr_level),
        publish_status = 'draft', published = false,
        updated_at = now();

      UPDATE program_draft SET status = 'published'
      WHERE id = rec.id;

      v_published := v_published + 1;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  RETURN QUERY SELECT v_published, v_skipped, v_errors;
END;
$function$;