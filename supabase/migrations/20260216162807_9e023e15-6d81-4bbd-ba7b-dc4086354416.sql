-- P0-1: Fix rpc_publish_university to use bigint[] instead of uuid[] for program_draft IDs
CREATE OR REPLACE FUNCTION public.rpc_publish_university(
  p_university_id uuid,
  p_options jsonb DEFAULT '{}'::jsonb,
  p_trace_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_published_count int := 0;
  v_skipped_count int := 0;
  v_draft record;
  v_only_eligible boolean := coalesce((p_options->>'only_eligible')::boolean, true);
  v_program_ids bigint[];
BEGIN
  -- Check admin
  IF NOT public.is_admin(v_user_id) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  -- Get selected program IDs or all
  IF p_options ? 'program_draft_ids' THEN
    SELECT array_agg(val::bigint) INTO v_program_ids
    FROM jsonb_array_elements_text(p_options->'program_draft_ids') val;
  END IF;

  -- Publish each eligible draft
  FOR v_draft IN
    SELECT pd.*
    FROM program_draft pd
    WHERE pd.university_id = p_university_id
      AND pd.review_status != 'published'
      AND (v_program_ids IS NULL OR pd.id = ANY(v_program_ids))
  LOOP
    -- Skip if only_eligible and missing critical fields
    IF v_only_eligible AND (v_draft.title IS NULL OR v_draft.degree_level IS NULL) THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    -- Update draft status
    UPDATE program_draft
    SET review_status = 'published',
        published_at = now(),
        published_by = v_user_id,
        publish_trace_id = p_trace_id
    WHERE id = v_draft.id;

    v_published_count := v_published_count + 1;
  END LOOP;

  -- Update university publish status
  UPDATE universities
  SET publish_status = 'published',
      published_at = now(),
      published_by = v_user_id,
      publish_trace_id = p_trace_id
  WHERE id = p_university_id;

  -- Log telemetry
  INSERT INTO pipeline_health_events (pipeline, event_type, details_json)
  VALUES ('crawl_review', 'publish_university', jsonb_build_object(
    'trace_id', p_trace_id,
    'university_id', p_university_id,
    'published_count', v_published_count,
    'skipped_count', v_skipped_count,
    'actor_id', v_user_id
  ));

  RETURN jsonb_build_object(
    'ok', true,
    'university_id', p_university_id,
    'published_count', v_published_count,
    'skipped_count', v_skipped_count
  );
END;
$$;