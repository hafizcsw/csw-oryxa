
CREATE OR REPLACE FUNCTION public.rpc_publish_program_language_from_draft(
  p_draft_id   bigint,
  p_program_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft        record;
  v_old          record;
  v_ej           jsonb;
  v_fem          jsonb;
  v_new_ielts    numeric;
  v_new_toefl    numeric;
  v_new_duolingo numeric;
  v_new_pte      numeric;
  v_new_cefr     text;
  v_changes      jsonb := '{}'::jsonb;
  v_trace_id     text;
BEGIN
  SELECT * INTO v_draft FROM program_draft WHERE id = p_draft_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'draft not found'); END IF;
  IF v_draft.schema_version != 'osc_language_v1' THEN RETURN jsonb_build_object('ok', false, 'error', 'wrong schema_version'); END IF;
  IF v_draft.published_at IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'already published'); END IF;

  v_ej  := v_draft.extracted_json;
  v_fem := COALESCE(v_draft.field_evidence_map, '{}'::jsonb);

  v_new_ielts    := (v_ej->>'min_ielts')::numeric;
  v_new_toefl    := (v_ej->>'min_toefl')::numeric;
  v_new_duolingo := (v_ej->>'duolingo_min')::numeric;
  v_new_pte      := (v_ej->>'pte_min')::numeric;
  v_new_cefr     := v_ej->>'cefr_level';

  SELECT ielts_min_overall, toefl_min, duolingo_min, pte_min, cefr_level
    INTO v_old FROM programs WHERE id = p_program_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'program not found'); END IF;

  IF v_new_ielts IS NOT NULL THEN
    v_changes := v_changes || jsonb_build_object('ielts_min_overall', jsonb_build_object('old', to_jsonb(v_old.ielts_min_overall), 'new', to_jsonb(v_new_ielts)));
    v_fem := jsonb_set(v_fem, '{min_ielts,old_value}', to_jsonb(v_old.ielts_min_overall));
  END IF;
  IF v_new_toefl IS NOT NULL THEN
    v_changes := v_changes || jsonb_build_object('toefl_min', jsonb_build_object('old', to_jsonb(v_old.toefl_min), 'new', to_jsonb(v_new_toefl)));
    v_fem := jsonb_set(v_fem, '{min_toefl,old_value}', to_jsonb(v_old.toefl_min));
  END IF;
  IF v_new_duolingo IS NOT NULL THEN
    v_changes := v_changes || jsonb_build_object('duolingo_min', jsonb_build_object('old', to_jsonb(v_old.duolingo_min), 'new', to_jsonb(v_new_duolingo)));
    v_fem := jsonb_set(v_fem, '{duolingo_min,old_value}', to_jsonb(v_old.duolingo_min));
  END IF;
  IF v_new_pte IS NOT NULL THEN
    v_changes := v_changes || jsonb_build_object('pte_min', jsonb_build_object('old', to_jsonb(v_old.pte_min), 'new', to_jsonb(v_new_pte)));
    v_fem := jsonb_set(v_fem, '{pte_min,old_value}', to_jsonb(v_old.pte_min));
  END IF;
  IF v_new_cefr IS NOT NULL THEN
    v_changes := v_changes || jsonb_build_object('cefr_level', jsonb_build_object('old', to_jsonb(v_old.cefr_level), 'new', to_jsonb(v_new_cefr)));
    v_fem := jsonb_set(v_fem, '{cefr_level,old_value}', to_jsonb(v_old.cefr_level));
  END IF;

  IF v_changes = '{}'::jsonb THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no values to publish');
  END IF;

  UPDATE programs SET
    ielts_min_overall = COALESCE(v_new_ielts, ielts_min_overall),
    ielts_required    = CASE WHEN v_new_ielts IS NOT NULL THEN v_new_ielts ELSE ielts_required END,
    toefl_min         = COALESCE(v_new_toefl, toefl_min),
    toefl_required    = CASE WHEN v_new_toefl IS NOT NULL THEN true ELSE toefl_required END,
    duolingo_min      = COALESCE(v_new_duolingo, duolingo_min),
    pte_min           = COALESCE(v_new_pte, pte_min),
    cefr_level        = COALESCE(v_new_cefr, cefr_level)
  WHERE id = p_program_id;

  v_trace_id := 'lang-pub-' || gen_random_uuid()::text;

  UPDATE program_draft SET
    published_at        = now(),
    published_program_id = p_program_id,
    review_status       = 'published',
    publish_trace_id    = v_trace_id,
    field_evidence_map   = v_fem
  WHERE id = p_draft_id;

  RETURN jsonb_build_object(
    'ok', true, 'program_id', p_program_id, 'draft_id', p_draft_id,
    'trace_id', v_trace_id, 'changes', v_changes
  );
END;
$$;
