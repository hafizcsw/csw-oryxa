-- FIX: Atomic versioned delete using single DELETE statement with condition
CREATE OR REPLACE FUNCTION public.delete_service_selection(
  p_auth_user_id uuid,
  p_country_code text,
  p_state_rev integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rowcount integer;
  v_current_rev integer;
BEGIN
  -- ATOMIC: Single DELETE with state_rev condition in WHERE clause
  DELETE FROM customer_service_selections
  WHERE auth_user_id = p_auth_user_id
    AND country_code = p_country_code
    AND state_rev <= p_state_rev;
  
  GET DIAGNOSTICS v_rowcount = ROW_COUNT;

  IF v_rowcount > 0 THEN
    RETURN jsonb_build_object('ok', true, 'deleted', true);
  ELSE
    -- Get current rev for response (record either doesn't exist or has higher rev)
    SELECT state_rev INTO v_current_rev
    FROM customer_service_selections
    WHERE auth_user_id = p_auth_user_id AND country_code = p_country_code;
    
    IF v_current_rev IS NULL THEN
      -- Record doesn't exist at all
      RETURN jsonb_build_object('ok', true, 'deleted', false, 'reason', 'not_found');
    ELSE
      -- Record exists but has higher rev (stale delete)
      RETURN jsonb_build_object(
        'ok', true,
        'deleted', false,
        'reason', 'stale_delete_rev',
        'current_rev', v_current_rev,
        'incoming_rev', p_state_rev
      );
    END IF;
  END IF;
END;
$$;

-- FIX: Update mirror function with proper casts
CREATE OR REPLACE FUNCTION public.mirror_service_selection(
  p_auth_user_id uuid,
  p_country_code text,
  p_selected_services text[],
  p_selected_addons text[],
  p_selected_package_id text,
  p_pay_plan text,
  p_pricing_snapshot jsonb,
  p_pricing_version text,
  p_source text,
  p_state_rev integer,
  p_status text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_rev integer;
BEGIN
  -- Atomic conditional upsert: only update if incoming state_rev >= existing
  INSERT INTO customer_service_selections (
    auth_user_id, country_code, selected_services, selected_addons,
    selected_package_id, pay_plan, pricing_snapshot, pricing_version,
    source, state_rev, status, updated_at
  ) VALUES (
    p_auth_user_id, 
    p_country_code, 
    COALESCE(p_selected_services, '{}'::text[]),
    COALESCE(p_selected_addons, '{}'::text[]), 
    p_selected_package_id,
    COALESCE(p_pay_plan, 'full'), 
    COALESCE(p_pricing_snapshot, '{}'::jsonb),
    COALESCE(p_pricing_version, 'v1'), 
    COALESCE(p_source, 'crm_staff'),
    p_state_rev, 
    COALESCE(p_status, 'draft'), 
    now()
  )
  ON CONFLICT (auth_user_id, country_code)
  DO UPDATE SET
    selected_services = EXCLUDED.selected_services,
    selected_addons = EXCLUDED.selected_addons,
    selected_package_id = EXCLUDED.selected_package_id,
    pay_plan = EXCLUDED.pay_plan,
    pricing_snapshot = EXCLUDED.pricing_snapshot,
    pricing_version = EXCLUDED.pricing_version,
    source = EXCLUDED.source,
    state_rev = EXCLUDED.state_rev,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at
  WHERE customer_service_selections.state_rev <= EXCLUDED.state_rev
  RETURNING state_rev INTO v_current_rev;

  -- Check if update happened
  IF v_current_rev IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'applied', true, 'state_rev', v_current_rev);
  ELSE
    -- Get current rev for response
    SELECT state_rev INTO v_current_rev
    FROM customer_service_selections
    WHERE auth_user_id = p_auth_user_id AND country_code = p_country_code;
    
    RETURN jsonb_build_object(
      'ok', true, 
      'applied', false, 
      'reason', 'stale_state_rev',
      'current_rev', v_current_rev,
      'incoming_rev', p_state_rev
    );
  END IF;
END;
$$;

-- Security: Revoke from public/anon/authenticated, only service_role can call
REVOKE EXECUTE ON FUNCTION public.mirror_service_selection FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mirror_service_selection FROM anon;
REVOKE EXECUTE ON FUNCTION public.mirror_service_selection FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mirror_service_selection TO service_role;

REVOKE EXECUTE ON FUNCTION public.delete_service_selection FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_service_selection FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_service_selection FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_service_selection TO service_role;