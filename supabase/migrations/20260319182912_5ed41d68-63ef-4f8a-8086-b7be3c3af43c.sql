-- A) Add columns to programs
ALTER TABLE programs ADD COLUMN IF NOT EXISTS requirements_text text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS admission_notes_text text;

-- B) Fix promotion RPC to include requirements_text
CREATE OR REPLACE FUNCTION rpc_promote_program_admissions_to_draft(p_university_id uuid DEFAULT NULL)
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
            'entrance_exam_required', 'admission_notes_text', 'requirements_text'
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
        'osc_admissions_v2',
        v_fields, v_evidence,
        'draft', 'pending', now(),
        v_program_key
      )
      ON CONFLICT (program_key)
        DO UPDATE SET
          extracted_json = program_draft.extracted_json || EXCLUDED.extracted_json,
          field_evidence_map = program_draft.field_evidence_map || EXCLUDED.field_evidence_map,
          schema_version = 'osc_admissions_v2',
          review_status = 'draft',
          last_extracted_at = now()
      RETURNING id INTO v_draft_id;

      v_promoted := v_promoted + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('promoted', v_promoted, 'skipped', v_skipped);
END;
$$;

-- C) Publish RPC for admissions text fields
CREATE OR REPLACE FUNCTION rpc_publish_program_admissions_text_from_draft(
  p_draft_id bigint,
  p_program_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft record;
  v_before record;
  v_req_text text;
  v_adm_text text;
  v_trace text;
  v_changes jsonb := '{}'::jsonb;
BEGIN
  SELECT * INTO v_draft FROM program_draft WHERE id = p_draft_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft % not found', p_draft_id; END IF;

  v_req_text := v_draft.extracted_json->>'requirements_text';
  v_adm_text := v_draft.extracted_json->>'admission_notes_text';

  IF v_req_text IS NULL AND v_adm_text IS NULL THEN
    RAISE EXCEPTION 'Draft % has no requirements_text or admission_notes_text', p_draft_id;
  END IF;

  SELECT requirements_text, admission_notes_text INTO v_before
  FROM programs WHERE id = p_program_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Program % not found', p_program_id; END IF;

  v_trace := 'adm-txt-' || substr(gen_random_uuid()::text, 1, 12);

  v_changes := jsonb_build_object(
    'before', jsonb_build_object(
      'requirements_text', v_before.requirements_text,
      'admission_notes_text', v_before.admission_notes_text
    )
  );

  UPDATE programs SET
    requirements_text = COALESCE(v_req_text, requirements_text),
    admission_notes_text = COALESCE(v_adm_text, admission_notes_text)
  WHERE id = p_program_id;

  UPDATE program_draft SET
    status = 'published',
    review_status = 'approved',
    published_at = now(),
    publish_trace_id = v_trace,
    field_evidence_map = COALESCE(field_evidence_map, '{}'::jsonb) || jsonb_build_object('_publish_snapshot', v_changes)
  WHERE id = p_draft_id;

  RETURN jsonb_build_object(
    'ok', true,
    'trace_id', v_trace,
    'program_id', p_program_id,
    'draft_id', p_draft_id,
    'fields_written', jsonb_build_object(
      'requirements_text', v_req_text IS NOT NULL,
      'admission_notes_text', v_adm_text IS NOT NULL
    )
  );
END;
$$;

-- D) Update views
DROP VIEW IF EXISTS vw_program_details CASCADE;
CREATE OR REPLACE VIEW vw_program_details AS
SELECT
  p.id AS program_id, p.title AS program_name, p.title_ar AS program_name_ar, p.title AS program_name_en,
  p.duration_months, p.ielts_required, p.duolingo_min, p.pte_min, p.cefr_level, p.apply_url,
  p.application_deadline, p.requirements_text, p.admission_notes_text,
  p.next_intake_date, p.next_intake, p.description, p.languages, p.accepted_certificates,
  p.degree_id, d.name AS degree_name, d.name_ar AS degree_name_ar, d.name AS degree_name_en, d.slug AS degree_slug,
  u.id AS university_id, u.name AS university_name, u.name_ar AS university_name_ar, u.name_en AS university_name_en,
  u.city, u.logo_url, u.ranking, p.tuition_usd_min, p.tuition_usd_max, p.tuition_basis,
  p.currency_code AS program_currency, u.monthly_living AS university_monthly_living,
  c.id AS country_id, c.name_ar AS country_name, c.name_ar AS country_name_ar, c.name_en AS country_name_en,
  c.slug AS country_slug, c.currency_code
FROM programs p
JOIN universities u ON u.id = p.university_id
JOIN countries c ON c.id = u.country_id
LEFT JOIN degrees d ON d.id = p.degree_id
WHERE COALESCE(p.is_active, true) AND COALESCE(u.is_active, true);

DROP VIEW IF EXISTS vw_program_search CASCADE;
CREATE OR REPLACE VIEW vw_program_search AS
SELECT
  p.id AS program_id, p.title AS program_name, p.description, p.duration_months,
  p.ielts_required, p.duolingo_min, p.pte_min, p.cefr_level, p.apply_url,
  p.application_deadline, p.requirements_text, p.admission_notes_text,
  p.languages, p.next_intake, p.next_intake_date, p.accepted_certificates,
  u.id AS university_id, u.name AS university_name, u.city, u.logo_url, u.main_image_url,
  p.tuition_usd_min, p.tuition_usd_max, p.tuition_basis, p.currency_code AS program_currency,
  u.monthly_living AS university_monthly_living, u.ranking,
  c.id AS country_id, c.slug AS country_slug, c.name_ar AS country_name, c.currency_code,
  p.degree_id, d.name AS degree_name, d.slug AS degree_slug
FROM programs p
JOIN universities u ON u.id = p.university_id
JOIN countries c ON c.id = u.country_id
LEFT JOIN degrees d ON d.id = p.degree_id
WHERE COALESCE(p.is_active, true) = true AND COALESCE(u.is_active, true) = true;