
CREATE OR REPLACE FUNCTION public.rpc_promote_program_language_to_draft(
  _job_id uuid DEFAULT NULL,
  _university_id uuid DEFAULT NULL,
  _dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_promoted int := 0;
  v_skipped_dup int := 0;
  v_details jsonb := '[]'::jsonb;
  v_rec record;
  v_draft_id bigint;
  v_existing_draft_id bigint;
  v_extracted jsonb;
  v_evidence jsonb;
  v_field_key text;
  v_programs_touched uuid[] := '{}';
BEGIN
  FOR v_rec IN
    WITH ranked AS (
      SELECT DISTINCT ON (o.entity_id, o.field_name)
        o.id AS obs_id, o.entity_id, o.entity_type, o.university_id,
        o.field_name, o.value_raw, o.value_normalized,
        o.evidence_snippet, o.source_url, o.confidence,
        o.parser_version, o.job_id, o.row_id, o.page_title,
        p.title AS program_title, p.degree_level,
        u.name_en AS university_name
      FROM official_site_observations o
      JOIN programs p ON p.id = o.entity_id
      JOIN universities u ON u.id = o.university_id
      WHERE o.entity_type = 'program'
        AND o.fact_group = 'language_requirements'
        AND o.field_name IN ('min_ielts','min_toefl','duolingo_min','pte_min','cefr_level')
        AND (_job_id IS NULL OR o.job_id = _job_id)
        AND (_university_id IS NULL OR o.university_id = _university_id)
      ORDER BY o.entity_id, o.field_name, o.confidence DESC NULLS LAST, o.created_at DESC
    )
    SELECT * FROM ranked
  LOOP
    v_field_key := v_rec.field_name;

    -- Already touched this program: merge into existing draft
    IF v_rec.entity_id = ANY(v_programs_touched) THEN
      IF NOT _dry_run THEN
        UPDATE program_draft
        SET extracted_json = COALESCE(extracted_json, '{}'::jsonb) || jsonb_build_object(v_field_key, v_rec.value_raw),
            field_evidence_map = COALESCE(field_evidence_map, '{}'::jsonb) || jsonb_build_object(
              v_field_key, jsonb_build_object(
                'obs_id', v_rec.obs_id, 'quote', left(v_rec.evidence_snippet, 200),
                'source_url', v_rec.source_url, 'confidence', v_rec.confidence,
                'parser_version', v_rec.parser_version
              )
            ),
            last_extracted_at = now(), extractor_version = v_rec.parser_version
        WHERE published_program_id = v_rec.entity_id
          AND schema_version = 'osc_language_v1' AND review_status = 'draft'
        RETURNING id INTO v_draft_id;
      END IF;

      v_promoted := v_promoted + 1;
      v_details := v_details || jsonb_build_object(
        'obs_id', v_rec.obs_id, 'field', v_rec.field_name, 'value', v_rec.value_raw,
        'program_id', v_rec.entity_id, 'program_title', v_rec.program_title,
        'action', CASE WHEN _dry_run THEN 'would_merge' ELSE 'merged' END
      );
      CONTINUE;
    END IF;

    -- First field for this program
    v_extracted := jsonb_build_object(v_field_key, v_rec.value_raw);
    v_evidence := jsonb_build_object(v_field_key, jsonb_build_object(
      'obs_id', v_rec.obs_id, 'quote', left(v_rec.evidence_snippet, 200),
      'source_url', v_rec.source_url, 'confidence', v_rec.confidence,
      'parser_version', v_rec.parser_version
    ));

    -- Check existing draft
    SELECT id INTO v_existing_draft_id
    FROM program_draft
    WHERE published_program_id = v_rec.entity_id
      AND schema_version = 'osc_language_v1' AND review_status = 'draft'
    LIMIT 1;

    IF NOT _dry_run THEN
      IF v_existing_draft_id IS NOT NULL THEN
        UPDATE program_draft
        SET extracted_json = v_extracted, field_evidence_map = v_evidence,
            source_url = v_rec.source_url, last_extracted_at = now(),
            extractor_version = v_rec.parser_version, confidence_score = v_rec.confidence
        WHERE id = v_existing_draft_id;
        v_draft_id := v_existing_draft_id;
      ELSE
        INSERT INTO program_draft (
          title, university_name, university_id, country_code, degree_level,
          source_url, schema_version, status, review_status,
          extracted_json, field_evidence_map, confidence_score,
          published_program_id, last_extracted_at, extractor_version
        ) VALUES (
          v_rec.program_title, v_rec.university_name, v_rec.university_id,
          (SELECT country_code FROM universities WHERE id = v_rec.university_id LIMIT 1),
          v_rec.degree_level, v_rec.source_url, 'osc_language_v1', 'extracted', 'draft',
          v_extracted, v_evidence, v_rec.confidence,
          v_rec.entity_id, now(), v_rec.parser_version
        ) RETURNING id INTO v_draft_id;
      END IF;
    ELSE
      v_draft_id := COALESCE(v_existing_draft_id, -1);
    END IF;

    v_programs_touched := array_append(v_programs_touched, v_rec.entity_id);
    v_promoted := v_promoted + 1;
    v_details := v_details || jsonb_build_object(
      'obs_id', v_rec.obs_id, 'field', v_rec.field_name, 'value', v_rec.value_raw,
      'program_id', v_rec.entity_id, 'program_title', v_rec.program_title,
      'draft_id', v_draft_id,
      'action', CASE WHEN _dry_run THEN 'would_create_draft' ELSE 'created_draft' END
    );
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true, 'dry_run', _dry_run,
    'summary', jsonb_build_object(
      'promoted', v_promoted, 'skipped_duplicate', v_skipped_dup,
      'programs_touched', array_length(v_programs_touched, 1)
    ),
    'details', v_details
  );
END;
$function$;
