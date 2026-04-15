
-- 1) Replace rpc_publish_verified_university_geo with strict guards
CREATE OR REPLACE FUNCTION public.rpc_publish_verified_university_geo(
  p_row_id uuid,
  p_actor_id uuid,
  p_trace_id text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_row geo_verification_rows%ROWTYPE;
  v_before jsonb;
BEGIN
  SELECT * INTO v_row FROM geo_verification_rows WHERE id = p_row_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'row_not_found');
  END IF;

  -- STRICT: only verified rows with valid coordinates
  IF v_row.status <> 'verified' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'status_must_be_verified', 'actual', v_row.status);
  END IF;
  IF v_row.resolved_lat IS NULL OR v_row.resolved_lon IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'resolved_coordinates_missing');
  END IF;
  IF v_row.confidence IS NULL OR v_row.confidence < 30 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'confidence_too_low', 'actual', v_row.confidence);
  END IF;

  -- Snapshot before
  SELECT to_jsonb(u.*) INTO v_before
  FROM universities u WHERE u.id = v_row.university_id;

  -- Update university
  UPDATE universities SET
    geo_lat = v_row.resolved_lat,
    geo_lon = v_row.resolved_lon,
    geo_source = COALESCE(v_row.resolution_source, 'geo_verify'),
    geo_confidence = v_row.confidence
  WHERE id = v_row.university_id;

  -- Mark row as published
  UPDATE geo_verification_rows SET status = 'published', processed_at = now() WHERE id = p_row_id;

  -- Audit log
  INSERT INTO geo_verification_decisions (
    decision_type, entity_type, entity_id, row_id, actor_id,
    trace_id, reason, before_state, after_state
  ) VALUES (
    'approve_geo', 'university', v_row.university_id, p_row_id, p_actor_id,
    p_trace_id, p_reason, v_before,
    jsonb_build_object('geo_lat', v_row.resolved_lat, 'geo_lon', v_row.resolved_lon,
                       'geo_source', v_row.resolution_source, 'confidence', v_row.confidence)
  );

  RETURN jsonb_build_object('ok', true, 'university_id', v_row.university_id);
END;
$function$;

-- 2) New RPC for force-publishing flagged rows after manual review
CREATE OR REPLACE FUNCTION public.rpc_force_publish_geo_after_manual_review(
  p_row_id uuid,
  p_actor_id uuid,
  p_trace_id text,
  p_reason text,
  p_override_lat double precision DEFAULT NULL,
  p_override_lon double precision DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_row geo_verification_rows%ROWTYPE;
  v_before jsonb;
  v_lat double precision;
  v_lon double precision;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'reason_required_min_5_chars');
  END IF;

  SELECT * INTO v_row FROM geo_verification_rows WHERE id = p_row_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'row_not_found');
  END IF;

  IF v_row.status NOT IN ('flagged', 'unverifiable') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'status_must_be_flagged_or_unverifiable', 'actual', v_row.status);
  END IF;

  -- Use overrides if provided, else row values
  v_lat := COALESCE(p_override_lat, v_row.resolved_lat);
  v_lon := COALESCE(p_override_lon, v_row.resolved_lon);

  IF v_lat IS NULL OR v_lon IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'coordinates_required_use_overrides');
  END IF;

  SELECT to_jsonb(u.*) INTO v_before
  FROM universities u WHERE u.id = v_row.university_id;

  UPDATE universities SET
    geo_lat = v_lat,
    geo_lon = v_lon,
    geo_source = 'manual_review',
    geo_confidence = GREATEST(v_row.confidence, 50)
  WHERE id = v_row.university_id;

  UPDATE geo_verification_rows SET status = 'published', processed_at = now() WHERE id = p_row_id;

  INSERT INTO geo_verification_decisions (
    decision_type, entity_type, entity_id, row_id, actor_id,
    trace_id, reason, before_state, after_state
  ) VALUES (
    'force_publish_geo', 'university', v_row.university_id, p_row_id, p_actor_id,
    p_trace_id, p_reason, v_before,
    jsonb_build_object('geo_lat', v_lat, 'geo_lon', v_lon,
                       'geo_source', 'manual_review', 'confidence', GREATEST(v_row.confidence, 50),
                       'override_lat', p_override_lat, 'override_lon', p_override_lon)
  );

  RETURN jsonb_build_object('ok', true, 'university_id', v_row.university_id, 'method', 'force_publish');
END;
$function$;

-- 3) Replace rpc_reject_verified_university_geo with audit trail
CREATE OR REPLACE FUNCTION public.rpc_reject_verified_university_geo(
  p_row_id uuid,
  p_actor_id uuid,
  p_trace_id text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_row geo_verification_rows%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM geo_verification_rows WHERE id = p_row_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'row_not_found');
  END IF;

  IF v_row.status NOT IN ('verified', 'flagged', 'unverifiable') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status_for_reject', 'actual', v_row.status);
  END IF;

  UPDATE geo_verification_rows SET
    status = 'rejected',
    processed_at = now(),
    issues = array_append(COALESCE(issues, ARRAY[]::text[]), 'rejected_by_admin')
  WHERE id = p_row_id;

  INSERT INTO geo_verification_decisions (
    decision_type, entity_type, entity_id, row_id, actor_id,
    trace_id, reason, before_state, after_state
  ) VALUES (
    'reject_geo', 'university', v_row.university_id, p_row_id, p_actor_id,
    p_trace_id, p_reason,
    jsonb_build_object('status', v_row.status, 'confidence', v_row.confidence),
    jsonb_build_object('status', 'rejected')
  );

  RETURN jsonb_build_object('ok', true, 'university_id', v_row.university_id);
END;
$function$;
