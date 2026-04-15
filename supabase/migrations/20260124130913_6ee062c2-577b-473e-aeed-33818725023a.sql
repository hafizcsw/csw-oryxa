-- Add expires_at column to existing hmac_nonces table
ALTER TABLE public.hmac_nonces 
ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '10 minutes');

-- Create index if not exists
CREATE INDEX IF NOT EXISTS idx_hmac_nonces_expires_at
ON public.hmac_nonces (expires_at);

-- Secure the table
ALTER TABLE public.hmac_nonces ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hmac_nonces FROM PUBLIC;
REVOKE ALL ON TABLE public.hmac_nonces FROM anon;
REVOKE ALL ON TABLE public.hmac_nonces FROM authenticated;

-- ─────────────────────────────────────────
-- تأكيد unique constraint لجدول المرآة
-- ─────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customer_service_selections_auth_country_uniq'
  ) THEN
    ALTER TABLE public.customer_service_selections
      ADD CONSTRAINT customer_service_selections_auth_country_uniq
      UNIQUE (auth_user_id, country_code);
  END IF;
END $$;

-- ─────────────────────────────────────────
-- RPC: Atomic upsert by state_rev (BIGINT!)
-- ─────────────────────────────────────────
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
  p_state_rev bigint,
  p_status text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_applied_rev bigint;
  v_current_rev bigint;
BEGIN
  IF p_state_rev IS NULL OR p_state_rev < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'state_rev_invalid');
  END IF;

  INSERT INTO public.customer_service_selections (
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
    COALESCE(p_source, 'crm'),
    p_state_rev,
    COALESCE(p_status, 'active'),
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
  WHERE public.customer_service_selections.state_rev <= EXCLUDED.state_rev
  RETURNING state_rev INTO v_applied_rev;

  IF v_applied_rev IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'applied', true, 'state_rev', v_applied_rev);
  END IF;

  SELECT state_rev INTO v_current_rev
  FROM public.customer_service_selections
  WHERE auth_user_id = p_auth_user_id AND country_code = p_country_code;

  RETURN jsonb_build_object(
    'ok', true,
    'applied', false,
    'reason', 'stale_state_rev',
    'current_rev', v_current_rev,
    'incoming_rev', p_state_rev
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mirror_service_selection(uuid,text,text[],text[],text,text,jsonb,text,text,bigint,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mirror_service_selection(uuid,text,text[],text[],text,text,jsonb,text,text,bigint,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mirror_service_selection(uuid,text,text[],text[],text,text,jsonb,text,text,bigint,text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mirror_service_selection(uuid,text,text[],text[],text,text,jsonb,text,text,bigint,text) TO service_role;

-- ─────────────────────────────────────────
-- RPC: Atomic delete by state_rev (BIGINT!)
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_service_selection(
  p_auth_user_id uuid,
  p_country_code text,
  p_state_rev bigint
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows int := 0;
  v_current_rev bigint;
BEGIN
  IF p_state_rev IS NULL OR p_state_rev < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'delete_state_rev_required');
  END IF;

  DELETE FROM public.customer_service_selections
  WHERE auth_user_id = p_auth_user_id
    AND country_code = p_country_code
    AND state_rev <= p_state_rev;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows > 0 THEN
    RETURN jsonb_build_object('ok', true, 'deleted', true);
  END IF;

  SELECT state_rev INTO v_current_rev
  FROM public.customer_service_selections
  WHERE auth_user_id = p_auth_user_id AND country_code = p_country_code;

  IF v_current_rev IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'deleted', false, 'reason', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'deleted', false,
    'reason', 'stale_delete_rev',
    'current_rev', v_current_rev,
    'incoming_rev', p_state_rev
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_service_selection(uuid,text,bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_service_selection(uuid,text,bigint) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_service_selection(uuid,text,bigint) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_service_selection(uuid,text,bigint) TO service_role;