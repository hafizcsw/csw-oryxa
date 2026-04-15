CREATE OR REPLACE FUNCTION public.rpc_promote_program_admissions_to_draft(
  p_university_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promoted int := 0;
  v_skipped  int := 0;
  rec record;
BEGIN
  FOR rec IN
    SELECT DISTINCT ON (o.entity_id)
      o.entity_id AS program_id,
      o.university_id,
      o.source_url,
      o.page_title,
      o.trace_id
    FROM official_site_observations o
    WHERE o.entity_type = 'program'
      AND o.entity_id IS NOT NULL
      AND o.fact_group IN ('admissions', 'deadlines_intakes')
      AND o.status = 'new'
      AND (p_university_id IS NULL OR o.university_id = p_university_id)
    ORDER BY o.entity_id, o.confidence DESC
  LOOP
    DECLARE
      v_fields jsonb := '{}'::jsonb;
      v_evidence jsonb := '{}'::jsonb;
      field_rec record;
      v_draft_id bigint;
      v_program_title text;
      v_program_key text;
    BEGIN
      FOR field_rec IN
        SELECT DISTINCT ON (field_name)
          field_name, value_raw, confidence, evidence_snippet, source_url, id AS obs_id
        FROM official_site_observations
        WHERE entity_type = 'program'
          AND entity_id = rec.program_id
          AND fact_group IN ('admissions', 'deadlines_intakes')
          AND field_name IN (
            'application_deadline', 'intake_months', 'intake_label',
            'required_documents', 'interview_required', 'portfolio_required',
            'entrance_exam_required', 'admission_notes_text'
          )
        ORDER BY field_name, confidence DESC
      LOOP
        v_fields := v_fields || jsonb_build_object(field_rec.field_name, field_rec.value_raw);
        v_evidence := v_evidence || jsonb_build_object(
          field_rec.field_name,
          jsonb_build_object(
            'obs_id', field_rec.obs_id,
            'quote', left(field_rec.evidence_snippet, 300),
            'source_url', field_rec.source_url,
            'confidence', field_rec.confidence
          )
        );
      END LOOP;

      IF v_fields = '{}'::jsonb THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      SELECT title INTO v_program_title FROM programs WHERE id = rec.program_id;
      v_program_key := 'osc-adm-' || rec.program_id::text;

      INSERT INTO program_draft (
        university_id, university_name, title, source_url,
        schema_version, extracted_json, field_evidence_map,
        review_status, status, last_extracted_at, program_key
      ) VALUES (
        rec.university_id,
        rec.university_id::text,
        COALESCE(v_program_title, 'Unknown Program'),
        rec.source_url,
        'osc_admissions_v1',
        v_fields, v_evidence,
        'draft', 'pending', now(),
        v_program_key
      )
      ON CONFLICT (program_key)
        DO UPDATE SET
          extracted_json = program_draft.extracted_json || EXCLUDED.extracted_json,
          field_evidence_map = program_draft.field_evidence_map || EXCLUDED.field_evidence_map,
          schema_version = 'osc_admissions_v1',
          review_status = 'draft',
          last_extracted_at = now()
      RETURNING id INTO v_draft_id;

      v_promoted := v_promoted + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('promoted', v_promoted, 'skipped', v_skipped);
END;
$$;