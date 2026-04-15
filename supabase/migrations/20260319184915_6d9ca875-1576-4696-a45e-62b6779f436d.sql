-- Drop and recreate views with intake fields + create RPC

DROP VIEW IF EXISTS vw_program_details;
DROP VIEW IF EXISTS vw_program_search;

CREATE VIEW vw_program_details AS
SELECT p.id AS program_id,
    p.title AS program_name,
    p.title_ar AS program_name_ar,
    p.title AS program_name_en,
    p.duration_months,
    p.ielts_required,
    p.duolingo_min,
    p.pte_min,
    p.cefr_level,
    p.apply_url,
    p.application_deadline,
    p.requirements_text,
    p.admission_notes_text,
    p.intake_months,
    p.intake_label,
    p.next_intake_date,
    p.next_intake,
    p.description,
    p.languages,
    p.accepted_certificates,
    p.degree_id,
    d.name AS degree_name,
    d.name_ar AS degree_name_ar,
    d.name AS degree_name_en,
    d.slug AS degree_slug,
    u.id AS university_id,
    u.name AS university_name,
    u.name_ar AS university_name_ar,
    u.name_en AS university_name_en,
    u.city,
    u.logo_url,
    u.ranking,
    p.tuition_usd_min,
    p.tuition_usd_max,
    p.tuition_basis,
    p.currency_code AS program_currency,
    u.monthly_living AS university_monthly_living,
    c.id AS country_id,
    c.name_ar AS country_name,
    c.name_ar AS country_name_ar,
    c.name_en AS country_name_en,
    c.slug AS country_slug,
    c.currency_code
   FROM programs p
     JOIN universities u ON u.id = p.university_id
     JOIN countries c ON c.id = u.country_id
     LEFT JOIN degrees d ON d.id = p.degree_id
  WHERE COALESCE(p.is_active, true) AND COALESCE(u.is_active, true);

CREATE VIEW vw_program_search AS
SELECT p.id AS program_id,
    p.title AS program_name,
    p.description,
    p.duration_months,
    p.ielts_required,
    p.duolingo_min,
    p.pte_min,
    p.cefr_level,
    p.apply_url,
    p.application_deadline,
    p.requirements_text,
    p.admission_notes_text,
    p.intake_months,
    p.intake_label,
    p.languages,
    p.next_intake,
    p.next_intake_date,
    p.accepted_certificates,
    u.id AS university_id,
    u.name AS university_name,
    u.city,
    u.logo_url,
    u.main_image_url,
    p.tuition_usd_min,
    p.tuition_usd_max,
    p.tuition_basis,
    p.currency_code AS program_currency,
    u.monthly_living AS university_monthly_living,
    u.ranking,
    c.id AS country_id,
    c.slug AS country_slug,
    c.name_ar AS country_name,
    c.currency_code,
    p.degree_id,
    d.name AS degree_name,
    d.slug AS degree_slug
   FROM programs p
     JOIN universities u ON u.id = p.university_id
     JOIN countries c ON c.id = u.country_id
     LEFT JOIN degrees d ON d.id = p.degree_id
  WHERE COALESCE(p.is_active, true) = true AND COALESCE(u.is_active, true) = true;

-- Create publish RPC
CREATE OR REPLACE FUNCTION rpc_publish_program_intake_from_draft(
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
  v_intake_months text;
  v_intake_label text;
  v_trace text;
BEGIN
  SELECT extracted_json, field_evidence_map, program_key, source_url
  INTO v_draft
  FROM program_draft WHERE id = p_draft_id;

  IF v_draft IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'draft not found');
  END IF;

  v_intake_months := v_draft.extracted_json->>'intake_months';
  v_intake_label  := v_draft.extracted_json->>'intake_label';

  IF v_intake_months IS NULL AND v_intake_label IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no intake fields in draft');
  END IF;

  SELECT intake_months, intake_label INTO v_before FROM programs WHERE id = p_program_id;

  v_trace := 'intake-pub-' || substr(md5(random()::text), 1, 12);

  UPDATE programs SET
    intake_months = CASE WHEN v_intake_months IS NOT NULL THEN ARRAY[initcap(v_intake_months)] ELSE intake_months END,
    intake_label = CASE WHEN v_intake_label IS NOT NULL THEN v_intake_label ELSE intake_label END
  WHERE id = p_program_id;

  UPDATE program_draft SET
    published_at = now(),
    publish_trace_id = v_trace,
    field_evidence_map = COALESCE(field_evidence_map, '{}'::jsonb) || jsonb_build_object(
      '_intake_publish_snapshot', jsonb_build_object(
        'before_intake_months', to_jsonb(v_before.intake_months),
        'before_intake_label', v_before.intake_label,
        'after_intake_months', v_intake_months,
        'after_intake_label', v_intake_label,
        'published_at', now(),
        'trace_id', v_trace
      )
    )
  WHERE id = p_draft_id;

  RETURN jsonb_build_object(
    'ok', true,
    'trace_id', v_trace,
    'program_id', p_program_id,
    'draft_id', p_draft_id,
    'before', jsonb_build_object('intake_months', to_jsonb(v_before.intake_months), 'intake_label', v_before.intake_label),
    'after', jsonb_build_object('intake_months', v_intake_months, 'intake_label', v_intake_label)
  );
END;
$$;