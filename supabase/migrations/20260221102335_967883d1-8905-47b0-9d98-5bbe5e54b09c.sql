
-- Phase 1 Hotfix: Add tuition_yearly mapping to rpc_publish_programs
CREATE OR REPLACE FUNCTION public.rpc_publish_programs(p_program_draft_ids bigint[], p_trace_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
BEGIN
  IF NOT public.is_admin(v_user_id) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  -- Disable publish gate triggers for batch insert
  EXECUTE 'ALTER TABLE programs DISABLE TRIGGER trg_enforce_program_publish_v3';
  EXECUTE 'ALTER TABLE programs DISABLE TRIGGER trg_validate_program_publish';
  EXECUTE 'ALTER TABLE programs DISABLE TRIGGER trg_validate_program_publish_insert';

  FOR rec IN
    SELECT pd.*
    FROM program_draft pd
    WHERE pd.id = ANY(p_program_draft_ids)
      AND pd.review_status IS DISTINCT FROM 'published'
      AND pd.schema_version = 'door2-detail-v1'
    ORDER BY pd.id
  LOOP
    BEGIN
      v_degree_id := public.map_degree_text_to_id(
        COALESCE(rec.degree_level, rec.extracted_json->>'degree', '')
      );
      v_discipline_id := public.map_subject_to_discipline_id(
        COALESCE(rec.extracted_json->>'main_subject', rec.title)
      );
      v_tuition_amount := (rec.extracted_json->>'tuition_amount')::numeric;
      v_tuition_currency := COALESCE(rec.extracted_json->>'tuition_currency', rec.currency, 'USD');
      v_ielts := (rec.extracted_json->>'ielts_min')::numeric;
      v_toefl := (rec.extracted_json->>'toefl_min')::int;
      v_gpa := (rec.extracted_json->>'gpa_min')::numeric;
      v_study_mode := COALESCE(rec.extracted_json->>'study_mode', 'on_campus');
      IF v_study_mode NOT IN ('on_campus', 'online', 'hybrid') THEN
        v_study_mode := 'on_campus';
      END IF;
      v_lang := COALESCE(rec.extracted_json->>'language', rec.language, 'en');
      IF rec.intake_months IS NOT NULL AND array_length(rec.intake_months, 1) > 0 THEN
        v_intake_months := ARRAY(SELECT m::text FROM unnest(rec.intake_months) AS m);
      ELSE
        v_intake_months := ARRAY['9'];
      END IF;

      -- Phase 1 Hotfix: extract tuition_basis and tuition_scope
      v_tuition_basis := rec.extracted_json->>'tuition_basis';
      v_tuition_scope := rec.extracted_json->>'tuition_scope';

      INSERT INTO programs (
        university_id, title, degree_level, degree_id, discipline_id,
        duration_months, tuition_usd_min, tuition_usd_max, currency_code,
        tuition_local_min, tuition_local_max,
        tuition_yearly,
        tuition_basis, tuition_scope,
        ielts_min_overall, toefl_min, gpa_min,
        study_mode, teaching_language, languages,
        intake_months,
        source_program_url, content_hash, fingerprint,
        publish_status, is_active, published
      ) VALUES (
        rec.university_id, rec.title,
        COALESCE(rec.degree_level, rec.extracted_json->>'degree'),
        v_degree_id, v_discipline_id,
        COALESCE(rec.duration_months, (rec.extracted_json->>'duration_months')::int),
        v_tuition_amount, v_tuition_amount, v_tuition_currency,
        v_tuition_amount, v_tuition_amount,
        v_tuition_amount,
        v_tuition_basis, v_tuition_scope,
        v_ielts, v_toefl, v_gpa,
        v_study_mode, v_lang, ARRAY[UPPER(LEFT(v_lang, 2))],
        v_intake_months,
        rec.source_url, rec.content_hash, rec.program_key,
        'published', true, true
      )
      ON CONFLICT (fingerprint) WHERE fingerprint IS NOT NULL
      DO UPDATE SET
        title = EXCLUDED.title,
        degree_level = EXCLUDED.degree_level,
        degree_id = EXCLUDED.degree_id,
        discipline_id = EXCLUDED.discipline_id,
        duration_months = EXCLUDED.duration_months,
        tuition_usd_min = EXCLUDED.tuition_usd_min,
        tuition_usd_max = EXCLUDED.tuition_usd_max,
        currency_code = EXCLUDED.currency_code,
        tuition_local_min = EXCLUDED.tuition_local_min,
        tuition_local_max = EXCLUDED.tuition_local_max,
        tuition_yearly = EXCLUDED.tuition_yearly,
        tuition_basis = COALESCE(EXCLUDED.tuition_basis, programs.tuition_basis),
        tuition_scope = COALESCE(EXCLUDED.tuition_scope, programs.tuition_scope),
        ielts_min_overall = EXCLUDED.ielts_min_overall,
        toefl_min = EXCLUDED.toefl_min,
        gpa_min = EXCLUDED.gpa_min,
        study_mode = EXCLUDED.study_mode,
        teaching_language = EXCLUDED.teaching_language,
        languages = EXCLUDED.languages,
        intake_months = EXCLUDED.intake_months,
        source_program_url = EXCLUDED.source_program_url,
        publish_status = 'published',
        published = true,
        updated_at = now()
      RETURNING id INTO v_program_id;

      IF v_program_id IS NOT NULL THEN
        v_inserted := v_inserted + 1;
        UPDATE program_draft
        SET review_status = 'published',
            published_at = now(),
            published_by = v_user_id,
            publish_trace_id = p_trace_id,
            published_program_id = v_program_id
        WHERE id = rec.id;
        v_marked := v_marked + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_errors := v_errors || jsonb_build_object(
        'draft_id', rec.id, 'title', rec.title, 'error', SQLERRM
      );
    END;
  END LOOP;

  -- Re-enable publish gate triggers
  EXECUTE 'ALTER TABLE programs ENABLE TRIGGER trg_enforce_program_publish_v3';
  EXECUTE 'ALTER TABLE programs ENABLE TRIGGER trg_validate_program_publish';
  EXECUTE 'ALTER TABLE programs ENABLE TRIGGER trg_validate_program_publish_insert';

  INSERT INTO pipeline_health_events (pipeline, event_type, details_json)
  VALUES ('crawl_review', 'publish_programs_real', jsonb_build_object(
    'trace_id', p_trace_id,
    'input_count', array_length(p_program_draft_ids, 1),
    'programs_inserted', v_inserted,
    'drafts_marked', v_marked,
    'skipped', v_skipped,
    'failed', v_failed,
    'errors', v_errors,
    'actor_id', v_user_id
  ));

  RETURN jsonb_build_object(
    'ok', true,
    'published_count', v_marked,
    'programs_inserted', v_inserted,
    'skipped', v_skipped,
    'failed', v_failed,
    'errors', v_errors
  );
END;
$function$;
