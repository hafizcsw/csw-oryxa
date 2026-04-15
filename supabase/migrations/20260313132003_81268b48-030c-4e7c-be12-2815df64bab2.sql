CREATE OR REPLACE FUNCTION public.rpc_set_primary_university_housing(
  p_housing_id uuid,
  p_actor_id uuid,
  p_trace_id text,
  p_reason text DEFAULT NULL::text
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

  -- Guard: housing must have price and currency for trigger compliance
  IF v_housing.price_monthly_local IS NULL OR v_housing.price_monthly_local <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'housing_missing_price',
      'detail', 'price_monthly_local must be > 0 on housing row before setting as primary');
  END IF;
  IF v_housing.currency_code IS NULL OR v_housing.currency_code = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'housing_missing_currency',
      'detail', 'currency_code must be set on housing row before setting as primary');
  END IF;

  -- Capture before state from universities
  SELECT jsonb_build_object(
    'has_dorm', u.has_dorm, 'dorm_lat', u.dorm_lat,
    'dorm_lon', u.dorm_lon, 'dorm_address', u.dorm_address,
    'dorm_price_monthly_local', u.dorm_price_monthly_local,
    'dorm_currency_code', u.dorm_currency_code
  ) INTO v_before
  FROM universities u WHERE u.id = v_housing.university_id;

  -- Clear old primary
  UPDATE university_housing_locations SET is_primary = false
  WHERE university_id = v_housing.university_id AND is_primary = true AND id != p_housing_id;

  -- Set new primary
  UPDATE university_housing_locations SET is_primary = true, status = 'approved'
  WHERE id = p_housing_id;

  -- Update universities denormalized fields INCLUDING price/currency for trigger
  UPDATE universities SET
    has_dorm = true,
    dorm_lat = v_housing.lat,
    dorm_lon = v_housing.lon,
    dorm_address = v_housing.address,
    dorm_price_monthly_local = v_housing.price_monthly_local,
    dorm_currency_code = v_housing.currency_code
  WHERE id = v_housing.university_id;

  v_after := jsonb_build_object(
    'has_dorm', true, 'dorm_lat', v_housing.lat,
    'dorm_lon', v_housing.lon, 'dorm_address', v_housing.address,
    'dorm_price_monthly_local', v_housing.price_monthly_local,
    'dorm_currency_code', v_housing.currency_code
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