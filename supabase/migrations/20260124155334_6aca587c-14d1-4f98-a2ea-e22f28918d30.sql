-- Drop the duplicate function with integer type (keep only bigint)
DROP FUNCTION IF EXISTS public.mirror_service_selection(
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
);

-- Verify only the bigint version remains
-- The bigint version should already exist, but let's ensure it's correctly defined
CREATE OR REPLACE FUNCTION public.mirror_service_selection(
  p_auth_user_id uuid,
  p_country_code text,
  p_selected_services text[] DEFAULT '{}',
  p_selected_addons text[] DEFAULT '{}',
  p_selected_package_id text DEFAULT NULL,
  p_pay_plan text DEFAULT 'full',
  p_pricing_snapshot jsonb DEFAULT '{}',
  p_pricing_version text DEFAULT 'v1',
  p_source text DEFAULT 'crm',
  p_state_rev bigint DEFAULT 0,
  p_status text DEFAULT 'active'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_rev bigint;
  v_result jsonb;
BEGIN
  -- Get existing state_rev if any
  SELECT state_rev INTO v_existing_rev
  FROM customer_service_selections
  WHERE auth_user_id = p_auth_user_id AND country_code = p_country_code;

  -- Skip if incoming rev is older or equal
  IF v_existing_rev IS NOT NULL AND p_state_rev <= v_existing_rev THEN
    RETURN jsonb_build_object(
      'ok', true,
      'action', 'skipped',
      'reason', 'stale_rev',
      'existing_rev', v_existing_rev,
      'incoming_rev', p_state_rev
    );
  END IF;

  -- Upsert the selection
  INSERT INTO customer_service_selections (
    auth_user_id,
    country_code,
    selected_services,
    selected_addons,
    selected_package_id,
    pay_plan,
    pricing_snapshot,
    pricing_version,
    source,
    state_rev,
    status,
    updated_at
  ) VALUES (
    p_auth_user_id,
    p_country_code,
    p_selected_services,
    p_selected_addons,
    p_selected_package_id,
    p_pay_plan,
    p_pricing_snapshot,
    p_pricing_version,
    p_source,
    p_state_rev,
    p_status,
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
    updated_at = now()
  WHERE customer_service_selections.state_rev < EXCLUDED.state_rev;

  RETURN jsonb_build_object(
    'ok', true,
    'action', CASE WHEN v_existing_rev IS NULL THEN 'inserted' ELSE 'updated' END,
    'auth_user_id', p_auth_user_id,
    'country_code', p_country_code,
    'state_rev', p_state_rev
  );
END;
$$;