CREATE OR REPLACE FUNCTION public.rpc_publish_programs(p_program_draft_ids uuid[], p_trace_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_inserted int := 0;
  v_updated int := 0;
  v_skipped int := 0;
  v_failed int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_marked int := 0;
  rec RECORD;
  v_degree_id uuid;
  v_discipline_id uuid;
  v_program_id uuid;
  v_tuition_amount numeric;
  v_tuition_currency text;
  v_ielts numeric;
  v_toefl int;
  v_gpa numeric;
  v_study_mode text;
  v_lang text;
  v_intake_months text[];
  v_tuition_basis text;
  v_tuition_scope text;
  v_apply_url text;
  v_duolingo numeric;
  v_pte numeric;
  v_cefr text;
  v_ielts_flag smallint;
BEGIN
  IF NOT public.is_admin(v_user_id) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  EXECUTE 'ALTER TABLE programs DISABLE TRIGGER trg_enforce_program_publish_v3';
  EXECUTE 'ALTER TABLE programs DISABLE TRIGGER trg_validate_program_publish';
  EXECUTE 'ALTER TABLE programs DISABLE TRIGGER trg_validate_program_publish_insert';

  FOR rec IN
    SELECT pd.*
    FROM program_draft pd
    WHERE pd.id = ANY(p_program_draft_ids)
      AND pd.review_status IS DISTINCT FROM 'published'
      AND pd.schema_version IN ('door2-detail-v1', 'door5-programs-v1', 'qs_bridge_v1')
    ORDER BY pd.id
  LOOP
    BEGIN
      v_degree_id := public.map_degree_text_to_id(
        COALESCE(rec.degree_level, rec.extracted_json->>'degree', '')
      );
      v_discipline_id := public.map_subject_to_discipline_id(
        COALESCE(rec.extracted_json->>'main_subject', rec.extracted_json->>'subject_area', rec.title)
      );
      v_tuition_amount := (rec.extracted_json->>'tuition_amount')::numeric;
      IF v_tuition_amount IS NULL THEN
        v_tuition_amount := (rec.extracted_json->>'tuition_domestic')::numeric;
      END IF;
      v_tuition_currency := COALESCE(rec.extracted_json->>'tuition_currency', rec.currency, 'USD');
      
      v_ielts := COALESCE(
        (rec.extracted_json->>'ielts_min')::numeric,
        (rec.extracted_json->'admission_requirements'->'test_scores'->>'ielts')::numeric
      );
      v_toefl := COALESCE(
        (rec.extracted_json->>'toefl_min')::int,
        (rec.extracted_json->'admission_requirements'->'test_scores'->>'toefl')::int
      );
      v_gpa := (rec.extracted_json->>'gpa_min')::numeric;
      v_study_mode := COALESCE(rec.extracted_json->>'study_mode', 'on_campus');
      v_study_mode := LOWER(REPLACE(v_study_mode, ' ', '_'));
      IF v_study_mode NOT IN ('on_campus', 'online', 'hybrid') THEN
        v_study_mode := 'on_campus';
      END IF;
      v_lang := COALESCE(rec.extracted_json->>'language', rec.language, 'en');
      
      IF rec.intake_months IS NOT NULL AND array_length(rec.intake_months, 1) > 0 THEN
        v_intake_months := ARRAY(SELECT m::text FROM unnest(rec.intake_months) AS m);
      ELSIF rec.extracted_json->'start_months' IS NOT NULL AND jsonb_typeof(rec.extracted_json->'start_months') = 'array' THEN
        v_intake_months := ARRAY(
          SELECT CASE LOWER(m)
            WHEN 'jan' THEN '1' WHEN 'feb' THEN '2' WHEN 'mar' THEN '3'
            WHEN 'apr' THEN '4' WHEN 'may' THEN '5' WHEN 'jun' THEN '6'
            WHEN 'jul' THEN '7' WHEN 'aug' THEN '8' WHEN 'sep' THEN '9'
            WHEN 'oct' THEN '10' WHEN 'nov' THEN '11' WHEN 'dec' THEN '12'
            ELSE '9'
          END
          FROM jsonb_array_elements_text(rec.extracted_json->'start_months') AS m
        );
      ELSE
        v_intake_months := ARRAY['9'];
      END IF;
      
      v_tuition_basis := rec.extracted_json->>'tuition_basis';
      v_tuition_scope := rec.extracted_json->>'tuition_scope';

      v_apply_url := COALESCE(rec.extracted_json->>'apply_url', rec.extracted_json->>'detail_url', rec.source_program_url);
      v_duolingo := COALESCE(
        (rec.extracted_json->>'duolingo_min')::numeric,
        (rec.extracted_json->'admission_requirements'->'test_scores'->>'duolingo')::numeric
      );
      v_pte := COALESCE(
        (rec.extracted_json->>'pte_min')::numeric,
        (rec.extracted_json->'admission_requirements'->'test_scores'->>'pte')::numeric
      );
      v_cefr := rec.extracted_json->>'cefr_level';

      IF v_ielts IS NOT NULL THEN
        v_ielts_flag := 1;
      ELSE
        v_ielts_flag := NULL;
      END IF;

      INSERT INTO programs (
        university_id, title, degree_level, degree_id, discipline_id,
        duration_months, tuition_usd_min, tuition_usd_max, currency_code,
        tuition_local_min, tuition_local_max, tuition_yearly,
        tuition_basis, tuition_scope,
        ielts_min_overall, toefl_min, gpa_min,
        ielts_required, duolingo_min, pte_min, cefr_level,
        apply_url,
        study_mode, teaching_language, languages, intake_months,
        source_program_url, content_hash, fingerprint,
        publish_status, is_active, published
      ) VALUES (
        rec.university_id, rec.title,
        COALESCE(rec.degree_level, rec.extracted_json->>'degree'),
        v_degree_id, v_discipline_id,
        COALESCE(rec.duration_months, (rec.extracted_json->>'duration_months')::int),
        v_tuition_amount, v_tuition_amount, v_tuition_currency,
        v_tuition_amount, v_tuition_amount, v_tuition_amount,
        v_tuition_basis, v_tuition_scope,
        v_ielts, v_toefl, v_gpa,
        v_ielts_flag, v_duolingo, v_pte, v_cefr,
        v_apply_url,
        v_study_mode, v_lang, ARRAY[UPPER(LEFT(v_lang, 2))],
        v_intake_months,
        rec.source_url, rec.content_hash, rec.program_key,
        'published', true, true
      )
      ON CONFLICT (fingerprint) WHERE fingerprint IS NOT NULL
      DO UPDATE SET
        title = EXCLUDED.title, degree_level = EXCLUDED.degree_level,
        degree_id = EXCLUDED.degree_id, discipline_id = EXCLUDED.discipline_id,
        duration_months = EXCLUDED.duration_months,
        tuition_usd_min = EXCLUDED.tuition_usd_min, tuition_usd_max = EXCLUDED.tuition_usd_max,
        currency_code = EXCLUDED.currency_code,
        tuition_local_min = EXCLUDED.tuition_local_min, tuition_local_max = EXCLUDED.tuition_local_max,
        tuition_yearly = EXCLUDED.tuition_yearly,
        tuition_basis = COALESCE(EXCLUDED.tuition_basis, programs.tuition_basis),
        tuition_scope = COALESCE(EXCLUDED.tuition_scope, programs.tuition_scope),
        ielts_min_overall = EXCLUDED.ielts_min_overall, toefl_min = EXCLUDED.toefl_min, gpa_min = EXCLUDED.gpa_min,
        ielts_required = COALESCE(EXCLUDED.ielts_required, programs.ielts_required),
        duolingo_min = COALESCE(EXCLUDED.duolingo_min, programs.duolingo_min),
        pte_min = COALESCE(EXCLUDED.pte_min, programs.pte_min),
        cefr_level = COALESCE(EXCLUDED.cefr_level, programs.cefr_level),
        apply_url = COALESCE(EXCLUDED.apply_url, programs.apply_url),
        study_mode = EXCLUDED.study_mode, teaching_language = EXCLUDED.teaching_language,
        languages = EXCLUDED.languages, intake_months = EXCLUDED.intake_months,
        source_program_url = EXCLUDED.source_program_url,
        publish_status = 'published', published = true, updated_at = now()
      RETURNING id INTO v_program_id;

      IF v_program_id IS NOT NULL THEN
        v_inserted := v_inserted + 1;
        UPDATE program_draft SET review_status = 'published', published_at = now(),
            published_by = v_user_id, publish_trace_id = p_trace_id, published_program_id = v_program_id
        WHERE id = rec.id;
        v_marked := v_marked + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_errors := v_errors || jsonb_build_object('draft_id', rec.id, 'title', rec.title, 'error', SQLERRM);
    END;
  END LOOP;

  EXECUTE 'ALTER TABLE programs ENABLE TRIGGER trg_enforce_program_publish_v3';
  EXECUTE 'ALTER TABLE programs ENABLE TRIGGER trg_validate_program_publish';
  EXECUTE 'ALTER TABLE programs ENABLE TRIGGER trg_validate_program_publish_insert';

  INSERT INTO pipeline_health_events (pipeline, event_type, details_json)
  VALUES ('crawl_review', 'publish_programs_real', jsonb_build_object(
    'trace_id', p_trace_id, 'input_count', array_length(p_program_draft_ids, 1),
    'programs_inserted', v_inserted, 'drafts_marked', v_marked,
    'skipped', v_skipped, 'failed', v_failed, 'errors', v_errors, 'actor_id', v_user_id
  ));

  RETURN jsonb_build_object('ok', true, 'published_count', v_marked,
    'programs_inserted', v_inserted, 'skipped', v_skipped, 'failed', v_failed, 'errors', v_errors);
END;
$$;