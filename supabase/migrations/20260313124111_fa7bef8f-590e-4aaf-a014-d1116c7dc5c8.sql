
-- Phase B: Fix lock semantics + add publish/reject RPCs

-- 1. Add proper lock columns to geo_verification_rows
ALTER TABLE public.geo_verification_rows ADD COLUMN IF NOT EXISTS locked_at timestamptz;
ALTER TABLE public.geo_verification_rows ADD COLUMN IF NOT EXISTS lease_owner text;
ALTER TABLE public.geo_verification_rows ADD COLUMN IF NOT EXISTS lock_expires_at timestamptz;

-- 2. Update rpc_geo_lock_batch to use locked_at instead of processed_at
CREATE OR REPLACE FUNCTION public.rpc_geo_lock_batch(
  p_job_id uuid,
  p_limit integer DEFAULT 2,
  p_lease text DEFAULT 'worker'::text
)
RETURNS SETOF geo_verification_rows
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH batch AS (
    SELECT id FROM geo_verification_rows
    WHERE job_id = p_job_id
      AND status = 'pending'
    ORDER BY created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE geo_verification_rows r
  SET status = 'processing',
      locked_at = now(),
      lease_owner = p_lease,
      lock_expires_at = now() + interval '5 minutes'
  FROM batch b
  WHERE r.id = b.id
  RETURNING r.*;
$function$;

-- 3. Publish RPC: rpc_publish_verified_university_geo
CREATE OR REPLACE FUNCTION public.rpc_publish_verified_university_geo(
  p_row_id uuid,
  p_actor_id uuid,
  p_trace_id text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row geo_verification_rows;
  v_before jsonb;
  v_after jsonb;
BEGIN
  -- 1. Fetch the verification row
  SELECT * INTO v_row FROM geo_verification_rows WHERE id = p_row_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'row_not_found');
  END IF;
  IF v_row.status NOT IN ('verified', 'flagged') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'row_status_invalid: ' || v_row.status);
  END IF;

  -- 2. Capture before state
  SELECT jsonb_build_object(
    'geo_lat', u.geo_lat, 'geo_lon', u.geo_lon,
    'geo_source', u.geo_source, 'geo_confidence', u.geo_confidence
  ) INTO v_before
  FROM universities u WHERE u.id = v_row.university_id;

  -- 3. Update universities
  UPDATE universities SET
    geo_lat = v_row.resolved_lat,
    geo_lon = v_row.resolved_lon,
    geo_source = v_row.resolution_source,
    geo_confidence = v_row.confidence
  WHERE id = v_row.university_id;

  -- 4. Capture after state
  v_after := jsonb_build_object(
    'geo_lat', v_row.resolved_lat, 'geo_lon', v_row.resolved_lon,
    'geo_source', v_row.resolution_source, 'geo_confidence', v_row.confidence
  );

  -- 5. Update row status
  UPDATE geo_verification_rows SET status = 'published', processed_at = now() WHERE id = p_row_id;

  -- 6. Log decision
  INSERT INTO geo_verification_decisions (
    decision_type, actor_id, target_university_id, target_row_id, job_id,
    trace_id, before_state, after_state, reason
  ) VALUES (
    'approve_geo', p_actor_id, v_row.university_id, p_row_id, v_row.job_id,
    p_trace_id, v_before, v_after, p_reason
  );

  RETURN jsonb_build_object('ok', true, 'university_id', v_row.university_id, 'before', v_before, 'after', v_after);
END;
$function$;

-- 4. Reject RPC: rpc_reject_verified_university_geo
CREATE OR REPLACE FUNCTION public.rpc_reject_verified_university_geo(
  p_row_id uuid,
  p_actor_id uuid,
  p_trace_id text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row geo_verification_rows;
BEGIN
  SELECT * INTO v_row FROM geo_verification_rows WHERE id = p_row_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'row_not_found');
  END IF;

  UPDATE geo_verification_rows SET status = 'rejected', processed_at = now() WHERE id = p_row_id;

  INSERT INTO geo_verification_decisions (
    decision_type, actor_id, target_university_id, target_row_id, job_id,
    trace_id, before_state, after_state, reason
  ) VALUES (
    'reject_geo', p_actor_id, v_row.university_id, p_row_id, v_row.job_id,
    p_trace_id,
    jsonb_build_object('resolved_lat', v_row.resolved_lat, 'resolved_lon', v_row.resolved_lon, 'confidence', v_row.confidence),
    '{}'::jsonb,
    p_reason
  );

  RETURN jsonb_build_object('ok', true, 'university_id', v_row.university_id);
END;
$function$;

-- 5. Set primary housing RPC
CREATE OR REPLACE FUNCTION public.rpc_set_primary_university_housing(
  p_housing_id uuid,
  p_actor_id uuid,
  p_trace_id text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_housing university_housing_locations;
  v_before jsonb;
  v_after jsonb;
BEGIN
  SELECT * INTO v_housing FROM university_housing_locations WHERE id = p_housing_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'housing_not_found');
  END IF;

  -- Capture before state from universities
  SELECT jsonb_build_object(
    'has_dorm', u.has_dorm, 'dorm_lat', u.dorm_lat,
    'dorm_lon', u.dorm_lon, 'dorm_address', u.dorm_address,
    'dorm_price_monthly_local', u.dorm_price_monthly_local
  ) INTO v_before
  FROM universities u WHERE u.id = v_housing.university_id;

  -- Clear old primary
  UPDATE university_housing_locations SET is_primary = false
  WHERE university_id = v_housing.university_id AND is_primary = true AND id != p_housing_id;

  -- Set new primary
  UPDATE university_housing_locations SET is_primary = true, status = 'approved'
  WHERE id = p_housing_id;

  -- Update universities denormalized fields
  UPDATE universities SET
    has_dorm = true,
    dorm_lat = v_housing.lat,
    dorm_lon = v_housing.lon,
    dorm_address = v_housing.address
  WHERE id = v_housing.university_id;

  v_after := jsonb_build_object(
    'has_dorm', true, 'dorm_lat', v_housing.lat,
    'dorm_lon', v_housing.lon, 'dorm_address', v_housing.address
  );

  -- Log decision
  INSERT INTO geo_verification_decisions (
    decision_type, actor_id, target_university_id, target_housing_id,
    trace_id, before_state, after_state, reason
  ) VALUES (
    'set_primary_dorm', p_actor_id, v_housing.university_id, p_housing_id,
    p_trace_id, v_before, v_after, p_reason
  );

  RETURN jsonb_build_object('ok', true, 'university_id', v_housing.university_id, 'before', v_before, 'after', v_after);
END;
$function$;
