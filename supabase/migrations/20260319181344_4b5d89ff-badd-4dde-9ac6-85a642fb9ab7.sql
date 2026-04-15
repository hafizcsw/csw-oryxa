-- Add application_deadline column to programs
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS application_deadline date;

COMMENT ON COLUMN public.programs.application_deadline
  IS 'Official application deadline extracted from program page. Nullable. Published via program_draft only.';

-- Publish RPC: application_deadline from program_draft to programs
CREATE OR REPLACE FUNCTION public.rpc_publish_program_deadline_from_draft(
  p_draft_id bigint,
  p_program_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deadline text;
  v_evidence jsonb;
  v_old_deadline date;
  v_parsed_deadline date;
  v_trace_id text;
BEGIN
  -- 1) Read draft
  SELECT
    extracted_json->>'application_deadline',
    field_evidence_map->'application_deadline'
  INTO v_deadline, v_evidence
  FROM program_draft
  WHERE id = p_draft_id;

  IF v_deadline IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no application_deadline in draft');
  END IF;

  -- 2) Parse date from text like "30 June 2026"
  BEGIN
    v_parsed_deadline := v_deadline::date;
  EXCEPTION WHEN OTHERS THEN
    -- Try common format "DD Month YYYY"
    BEGIN
      v_parsed_deadline := to_date(v_deadline, 'DD Month YYYY');
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        v_parsed_deadline := to_date(v_deadline, 'DD Mon YYYY');
      EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('ok', false, 'error', 'cannot parse date: ' || v_deadline);
      END;
    END;
  END;

  -- 3) Read old value
  SELECT application_deadline INTO v_old_deadline
  FROM programs WHERE id = p_program_id;

  -- 4) Generate trace
  v_trace_id := 'adm-pub-' || substr(md5(random()::text), 1, 12);

  -- 5) Overwrite programs
  UPDATE programs
  SET application_deadline = v_parsed_deadline
  WHERE id = p_program_id;

  -- 6) Stamp draft
  UPDATE program_draft
  SET
    published_at = now(),
    publish_trace_id = v_trace_id,
    review_status = 'published',
    field_evidence_map = COALESCE(field_evidence_map, '{}'::jsonb) ||
      jsonb_build_object('application_deadline_publish', jsonb_build_object(
        'old_value', v_old_deadline::text,
        'new_value', v_parsed_deadline::text,
        'trace_id', v_trace_id
      ))
  WHERE id = p_draft_id;

  RETURN jsonb_build_object(
    'ok', true,
    'program_id', p_program_id,
    'old_deadline', v_old_deadline,
    'new_deadline', v_parsed_deadline,
    'trace_id', v_trace_id
  );
END;
$$;