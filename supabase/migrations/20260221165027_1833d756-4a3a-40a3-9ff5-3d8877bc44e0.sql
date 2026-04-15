
-- Create a service-role publish function that bypasses auth.uid() check
-- This is only callable by service_role (not exposed to anon/authenticated)
CREATE OR REPLACE FUNCTION public.rpc_d4_publish_enrichment_internal(p_draft_id UUID, p_force BOOLEAN DEFAULT FALSE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft RECORD;
  v_current_value TEXT;
BEGIN
  -- No auth.uid() check — this is for service_role internal calls only

  SELECT * INTO v_draft FROM university_enrichment_draft WHERE id = p_draft_id AND status = 'pending';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'draft_not_found_or_not_pending');
  END IF;

  -- Check current value
  IF v_draft.field_name = 'website' THEN
    SELECT website INTO v_current_value FROM universities WHERE id = v_draft.university_id;
  ELSIF v_draft.field_name = 'acceptance_rate' THEN
    SELECT acceptance_rate::text INTO v_current_value FROM universities WHERE id = v_draft.university_id;
  ELSIF v_draft.field_name = 'university_type' THEN
    SELECT university_type INTO v_current_value FROM universities WHERE id = v_draft.university_id;
  ELSIF v_draft.field_name = 'enrolled_students' THEN
    SELECT enrolled_students::text INTO v_current_value FROM universities WHERE id = v_draft.university_id;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'unsupported_field: ' || v_draft.field_name);
  END IF;

  -- No-overwrite policy
  IF v_current_value IS NOT NULL AND v_current_value != '' AND NOT p_force THEN
    UPDATE university_enrichment_draft SET status = 'conflict', reviewed_at = now() WHERE id = p_draft_id;
    RETURN jsonb_build_object('ok', false, 'error', 'field_already_set', 'current_value', v_current_value);
  END IF;

  -- Apply update
  IF v_draft.field_name = 'website' THEN
    UPDATE universities SET website = v_draft.proposed_value WHERE id = v_draft.university_id;
  ELSIF v_draft.field_name = 'acceptance_rate' THEN
    UPDATE universities SET acceptance_rate = v_draft.proposed_value::numeric WHERE id = v_draft.university_id;
  ELSIF v_draft.field_name = 'university_type' THEN
    UPDATE universities SET university_type = v_draft.proposed_value WHERE id = v_draft.university_id;
  ELSIF v_draft.field_name = 'enrolled_students' THEN
    UPDATE universities SET enrolled_students = v_draft.proposed_value::int WHERE id = v_draft.university_id;
  END IF;

  -- Mark draft published
  UPDATE university_enrichment_draft
    SET status = 'published', published_at = now()
    WHERE id = p_draft_id;

  -- Upsert provenance
  INSERT INTO university_field_provenance (university_id, field_name, source_name, source_url, confidence, enrichment_draft_id, trace_id, updated_at)
  VALUES (v_draft.university_id, v_draft.field_name, v_draft.source_name, v_draft.source_url, v_draft.confidence, p_draft_id, v_draft.trace_id, now())
  ON CONFLICT (university_id, field_name) DO UPDATE SET
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    confidence = EXCLUDED.confidence,
    enrichment_draft_id = EXCLUDED.enrichment_draft_id,
    trace_id = EXCLUDED.trace_id,
    updated_at = EXCLUDED.updated_at;

  -- Telemetry
  INSERT INTO pipeline_health_events (pipeline, event, stage, trace_id, meta)
  VALUES ('d4_enrichment', 'field_published', v_draft.field_name,
    v_draft.trace_id,
    jsonb_build_object(
      'university_id', v_draft.university_id,
      'field', v_draft.field_name,
      'value', v_draft.proposed_value,
      'source', v_draft.source_name,
      'confidence', v_draft.confidence,
      'previous_value', v_current_value
    )
  );

  RETURN jsonb_build_object('ok', true, 'published', v_draft.field_name, 'university_id', v_draft.university_id);
END;
$$;

-- Revoke from anon/authenticated — only service_role can call this
REVOKE EXECUTE ON FUNCTION public.rpc_d4_publish_enrichment_internal FROM anon, authenticated;
