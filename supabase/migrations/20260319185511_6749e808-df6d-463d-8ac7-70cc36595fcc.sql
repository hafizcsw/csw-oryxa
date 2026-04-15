-- Add portfolio_required column
ALTER TABLE programs ADD COLUMN IF NOT EXISTS portfolio_required boolean;

-- Create publish RPC for structured entry-requirement fields from draft
CREATE OR REPLACE FUNCTION rpc_publish_program_entry_reqs_from_draft(
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
  v_trace text;
  v_portfolio text;
  v_interview text;
  v_exam text;
  v_docs text;
BEGIN
  SELECT extracted_json, field_evidence_map
  INTO v_draft
  FROM program_draft WHERE id = p_draft_id;

  IF v_draft IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'draft not found');
  END IF;

  v_portfolio := v_draft.extracted_json->>'portfolio_required';
  v_interview := v_draft.extracted_json->>'interview_required';
  v_exam      := v_draft.extracted_json->>'entrance_exam_required';
  v_docs      := v_draft.extracted_json->>'required_documents';

  IF v_portfolio IS NULL AND v_interview IS NULL AND v_exam IS NULL AND v_docs IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no entry-requirement fields in draft');
  END IF;

  SELECT portfolio_required, interview_required, entrance_exam_required, required_documents
  INTO v_before FROM programs WHERE id = p_program_id;

  v_trace := 'ereq-pub-' || substr(md5(random()::text), 1, 12);

  UPDATE programs SET
    portfolio_required = CASE WHEN v_portfolio IS NOT NULL THEN (v_portfolio = 'true') ELSE portfolio_required END,
    interview_required = CASE WHEN v_interview IS NOT NULL THEN (v_interview = 'true') ELSE interview_required END,
    entrance_exam_required = CASE WHEN v_exam IS NOT NULL THEN (v_exam = 'true') ELSE entrance_exam_required END,
    required_documents = CASE WHEN v_docs IS NOT NULL THEN v_docs ELSE required_documents END
  WHERE id = p_program_id;

  UPDATE program_draft SET
    published_at = now(),
    publish_trace_id = v_trace,
    field_evidence_map = COALESCE(field_evidence_map, '{}'::jsonb) || jsonb_build_object(
      '_entry_reqs_publish_snapshot', jsonb_build_object(
        'before', jsonb_build_object(
          'portfolio_required', v_before.portfolio_required,
          'interview_required', v_before.interview_required,
          'entrance_exam_required', v_before.entrance_exam_required,
          'required_documents', v_before.required_documents
        ),
        'after', jsonb_build_object(
          'portfolio_required', v_portfolio,
          'interview_required', v_interview,
          'entrance_exam_required', v_exam,
          'required_documents', v_docs
        ),
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
    'before', jsonb_build_object(
      'portfolio_required', v_before.portfolio_required,
      'interview_required', v_before.interview_required,
      'entrance_exam_required', v_before.entrance_exam_required,
      'required_documents', v_before.required_documents
    ),
    'after', jsonb_build_object(
      'portfolio_required', v_portfolio,
      'interview_required', v_interview,
      'entrance_exam_required', v_exam,
      'required_documents', v_docs
    )
  );
END;
$$;