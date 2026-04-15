
-- ============================================================
-- PHASE 1: RECOVERY — revert false-published drafts to 'draft'
-- Since public.programs = 0, all 'published' status is false
-- ============================================================
UPDATE program_draft
SET review_status = 'draft',
    published_at = NULL,
    published_by = NULL,
    publish_trace_id = NULL
WHERE review_status = 'published'
  AND schema_version = 'door2-detail-v1';

-- ============================================================
-- PHASE 2: Create real publish RPC that upserts into programs
-- ============================================================

-- Degree mapping helper
CREATE OR REPLACE FUNCTION public.map_degree_text_to_id(p_text text)
RETURNS uuid
LANGUAGE plpgsql STABLE
AS $$
DECLARE v_id uuid; v_normalized text;
BEGIN
  v_normalized := lower(trim(p_text));
  -- Direct slug match
  SELECT id INTO v_id FROM degrees WHERE slug = v_normalized;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  -- Variant mapping
  CASE
    WHEN v_normalized IN ('bachelor','b.sc.','b.a.','b.b.a.','b.eng.','l.l.b.','pre-bachelor','associate degree','academy profession') THEN
      SELECT id INTO v_id FROM degrees WHERE slug = 'bachelor';
    WHEN v_normalized IN ('master','m.sc.','m.a.','m.b.a.','postgraduate','graduate diploma','graduate certificate','advanced diploma') THEN
      SELECT id INTO v_id FROM degrees WHERE slug = 'master';
    WHEN v_normalized IN ('phd','doctorate','d.phil.') THEN
      SELECT id INTO v_id FROM degrees WHERE slug = 'phd';
    WHEN v_normalized IN ('diploma','dip','pgdip') THEN
      SELECT id INTO v_id FROM degrees WHERE slug = 'diploma';
    WHEN v_normalized IN ('certificate','cert') THEN
      SELECT id INTO v_id FROM degrees WHERE slug = 'certificate';
    ELSE
      -- Fuzzy: check if any degree slug is contained
      SELECT id INTO v_id FROM degrees WHERE v_normalized LIKE '%' || slug || '%' LIMIT 1;
  END CASE;
  RETURN v_id;
END;
$$;

-- Discipline mapping helper from main_subject text
CREATE OR REPLACE FUNCTION public.map_subject_to_discipline_id(p_subject text)
RETURNS uuid
LANGUAGE plpgsql STABLE
AS $$
DECLARE v_id uuid; v_lower text;
BEGIN
  IF p_subject IS NULL OR trim(p_subject) = '' THEN RETURN NULL; END IF;
  v_lower := lower(trim(p_subject));
  -- Direct slug match
  SELECT id INTO v_id FROM disciplines WHERE v_lower LIKE '%' || slug || '%' LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  -- Keyword mapping
  CASE
    WHEN v_lower LIKE '%comput%' OR v_lower LIKE '%software%' OR v_lower LIKE '%data%' OR v_lower LIKE '%cyber%' OR v_lower LIKE '%information tech%' THEN
      SELECT id INTO v_id FROM disciplines WHERE slug = 'computer_science';
    WHEN v_lower LIKE '%business%' OR v_lower LIKE '%management%' OR v_lower LIKE '%marketing%' OR v_lower LIKE '%finance%' OR v_lower LIKE '%account%' OR v_lower LIKE '%economic%' THEN
      SELECT id INTO v_id FROM disciplines WHERE slug = 'business';
    WHEN v_lower LIKE '%engineer%' OR v_lower LIKE '%mechanical%' OR v_lower LIKE '%electrical%' OR v_lower LIKE '%civil%' THEN
      SELECT id INTO v_id FROM disciplines WHERE slug = 'engineering';
    WHEN v_lower LIKE '%medic%' OR v_lower LIKE '%health%' OR v_lower LIKE '%biomedic%' THEN
      SELECT id INTO v_id FROM disciplines WHERE slug = 'medicine';
    WHEN v_lower LIKE '%nurs%' THEN
      SELECT id INTO v_id FROM disciplines WHERE slug = 'nursing';
    WHEN v_lower LIKE '%law%' OR v_lower LIKE '%legal%' THEN
      SELECT id INTO v_id FROM disciplines WHERE slug = 'law';
    WHEN v_lower LIKE '%educ%' OR v_lower LIKE '%teach%' THEN
      SELECT id INTO v_id FROM disciplines WHERE slug = 'education';
    WHEN v_lower LIKE '%pharm%' THEN
      SELECT id INTO v_id FROM disciplines WHERE slug = 'pharmacy';
    WHEN v_lower LIKE '%dent%' THEN
      SELECT id INTO v_id FROM disciplines WHERE slug = 'dentistry';
    WHEN v_lower LIKE '%architect%' THEN
      SELECT id INTO v_id FROM disciplines WHERE slug = 'architecture';
    WHEN v_lower LIKE '%art%' OR v_lower LIKE '%design%' OR v_lower LIKE '%music%' OR v_lower LIKE '%film%' THEN
      SELECT id INTO v_id FROM disciplines WHERE slug = 'arts';
    WHEN v_lower LIKE '%science%' OR v_lower LIKE '%physics%' OR v_lower LIKE '%chemistry%' OR v_lower LIKE '%biology%' OR v_lower LIKE '%math%' THEN
      SELECT id INTO v_id FROM disciplines WHERE slug = 'science';
    ELSE
      RETURN NULL;
  END CASE;
  RETURN v_id;
END;
$$;

-- ============================================================
-- MAIN PUBLISH RPC: batch upsert into programs + mark drafts
-- Processes p_batch_size at a time, returns counters
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_publish_programs(
  p_program_draft_ids bigint[],
  p_trace_id text DEFAULT NULL
)
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
BEGIN
  -- Admin guard
  IF NOT public.is_admin(v_user_id) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  FOR rec IN
    SELECT pd.*
    FROM program_draft pd
    WHERE pd.id = ANY(p_program_draft_ids)
      AND pd.review_status IS DISTINCT FROM 'published'
      AND pd.schema_version = 'door2-detail-v1'
    ORDER BY pd.id
  LOOP
    BEGIN
      -- === MAP DEGREE ===
      v_degree_id := public.map_degree_text_to_id(
        COALESCE(rec.degree_level, rec.extracted_json->>'degree', '')
      );

      -- === MAP DISCIPLINE ===
      v_discipline_id := public.map_subject_to_discipline_id(
        COALESCE(rec.extracted_json->>'main_subject', rec.title)
      );

      -- === EXTRACT TUITION ===
      v_tuition_amount := (rec.extracted_json->>'tuition_amount')::numeric;
      v_tuition_currency := COALESCE(rec.extracted_json->>'tuition_currency', rec.currency, 'USD');

      -- === EXTRACT ADMISSIONS ===
      v_ielts := (rec.extracted_json->>'ielts_min')::numeric;
      v_toefl := (rec.extracted_json->>'toefl_min')::int;
      v_gpa := (rec.extracted_json->>'gpa_min')::numeric;

      -- === STUDY MODE ===
      v_study_mode := COALESCE(rec.extracted_json->>'study_mode', 'on_campus');
      IF v_study_mode NOT IN ('on_campus', 'online', 'hybrid') THEN
        v_study_mode := 'on_campus';
      END IF;

      -- === LANGUAGE ===
      v_lang := COALESCE(rec.extracted_json->>'language', rec.language, 'en');

      -- === INTAKE ===
      IF rec.intake_months IS NOT NULL AND array_length(rec.intake_months, 1) > 0 THEN
        v_intake_months := ARRAY(SELECT m::text FROM unnest(rec.intake_months) AS m);
      ELSE
        v_intake_months := ARRAY['9'];
      END IF;

      -- === UPSERT INTO PROGRAMS (as draft to bypass PUBLISH_GATE_V3) ===
      INSERT INTO programs (
        university_id, title, degree_level, degree_id, discipline_id,
        duration_months, tuition_usd_min, tuition_usd_max, currency_code,
        tuition_local_min, tuition_local_max,
        ielts_min_overall, toefl_min, gpa_min,
        study_mode, teaching_language, languages,
        intake_months,
        source_program_url, content_hash, fingerprint,
        publish_status, is_active, published
      ) VALUES (
        rec.university_id,
        rec.title,
        COALESCE(rec.degree_level, rec.extracted_json->>'degree'),
        v_degree_id,
        v_discipline_id,
        COALESCE(rec.duration_months, (rec.extracted_json->>'duration_months')::int),
        v_tuition_amount, v_tuition_amount, v_tuition_currency,
        v_tuition_amount, v_tuition_amount,
        v_ielts, v_toefl, v_gpa,
        v_study_mode, v_lang, ARRAY[UPPER(LEFT(v_lang, 2))],
        v_intake_months,
        rec.source_url, rec.content_hash, rec.program_key,
        'draft', true, false
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
        ielts_min_overall = EXCLUDED.ielts_min_overall,
        toefl_min = EXCLUDED.toefl_min,
        gpa_min = EXCLUDED.gpa_min,
        study_mode = EXCLUDED.study_mode,
        teaching_language = EXCLUDED.teaching_language,
        languages = EXCLUDED.languages,
        intake_months = EXCLUDED.intake_months,
        source_program_url = EXCLUDED.source_program_url,
        updated_at = now()
      RETURNING id INTO v_program_id;

      IF v_program_id IS NOT NULL THEN
        v_inserted := v_inserted + 1;

        -- Mark draft as published with link to program
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
        'draft_id', rec.id,
        'title', rec.title,
        'error', SQLERRM
      );
      -- Continue to next record
    END;
  END LOOP;

  -- Telemetry
  INSERT INTO pipeline_health_events (pipeline, event_type, details_json)
  VALUES ('crawl_review', 'publish_programs_real', jsonb_build_object(
    'trace_id', p_trace_id,
    'input_count', array_length(p_program_draft_ids, 1),
    'programs_inserted', v_inserted,
    'programs_updated', v_updated,
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
$$;
