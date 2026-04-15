-- =============================================
-- Sprint B Security Fixes - Money Units + RPC Ownership
-- =============================================

-- 1) FIX MONEY UNITS: Rename amount_cents → amount_minor + add currency
ALTER TABLE public.notarized_payments 
  RENAME COLUMN amount_cents TO amount_minor;

ALTER TABLE public.notarized_payments 
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'RUB';

ALTER TABLE public.notarized_payments 
  ADD COLUMN IF NOT EXISTS amount_major NUMERIC(12,2) GENERATED ALWAYS AS (amount_minor::NUMERIC / 100) STORED;

-- Add comment for clarity
COMMENT ON COLUMN public.notarized_payments.amount_minor IS 'Amount in minor units (kopecks for RUB, cents for USD). Always use to_payment_minor_units() for conversion.';
COMMENT ON COLUMN public.notarized_payments.currency IS 'ISO 4217 currency code (RUB, USD, EUR, etc.)';
COMMENT ON COLUMN public.notarized_payments.amount_major IS 'Computed column: amount_minor / 100 for display purposes only';

-- 2) CREATE CONVERSION FUNCTION (single source of truth)
CREATE OR REPLACE FUNCTION public.to_payment_minor_units(
  p_currency TEXT,
  p_amount NUMERIC
) RETURNS INT AS $$
DECLARE
  v_multiplier INT;
BEGIN
  -- Define multipliers per currency (minor units per major unit)
  -- Most currencies use 100 (cents, kopecks, etc.)
  -- Some use 1000 (e.g., KWD, BHD, OMR) or 1 (e.g., JPY)
  CASE UPPER(p_currency)
    WHEN 'RUB' THEN v_multiplier := 100;  -- kopecks
    WHEN 'USD' THEN v_multiplier := 100;  -- cents
    WHEN 'EUR' THEN v_multiplier := 100;  -- cents
    WHEN 'GBP' THEN v_multiplier := 100;  -- pence
    WHEN 'AED' THEN v_multiplier := 100;  -- fils
    WHEN 'SAR' THEN v_multiplier := 100;  -- halalas
    WHEN 'EGP' THEN v_multiplier := 100;  -- piastres
    WHEN 'JPY' THEN v_multiplier := 1;    -- no minor unit
    WHEN 'KWD' THEN v_multiplier := 1000; -- fils (3 decimals)
    WHEN 'BHD' THEN v_multiplier := 1000; -- fils (3 decimals)
    WHEN 'OMR' THEN v_multiplier := 1000; -- baisa (3 decimals)
    ELSE v_multiplier := 100;              -- default assumption
  END CASE;
  
  RETURN FLOOR(p_amount * v_multiplier)::INT;
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER;

-- 3) UPDATE rpc_notarized_payment_start TO USE CORRECT UNITS + RETURN PAYMENT DETAILS
CREATE OR REPLACE FUNCTION public.rpc_notarized_payment_start(
  p_quote_id UUID,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_quote RECORD;
  v_order RECORD;
  v_existing_payment RECORD;
  v_payment_id UUID;
  v_amount_minor INT;
  v_currency TEXT := 'RUB';
  v_user_id UUID;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized', 'code', 'AUTH_REQUIRED');
  END IF;

  -- Get quote with order info
  SELECT q.*, o.customer_id, o.id as order_id_val
  INTO v_quote
  FROM notarized_translation_quotes q
  JOIN notarized_translation_orders o ON o.id = q.order_id
  WHERE q.id = p_quote_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Quote not found', 'code', 'QUOTE_NOT_FOUND');
  END IF;
  
  -- OWNERSHIP CHECK (enforced in RPC, not edge function)
  IF v_quote.customer_id != v_user_id THEN
    RETURN jsonb_build_object('error', 'unauthorized', 'code', 'NOT_OWNER');
  END IF;
  
  -- Quote must be accepted
  IF v_quote.status != 'accepted' THEN
    RETURN jsonb_build_object('error', 'Quote not accepted', 'code', 'QUOTE_NOT_ACCEPTED');
  END IF;
  
  -- Check quote expiry
  IF v_quote.expires_at IS NOT NULL AND v_quote.expires_at < NOW() THEN
    RETURN jsonb_build_object('error', 'Quote expired', 'code', 'QUOTE_EXPIRED');
  END IF;
  
  -- Check for existing pending payment (idempotency)
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing_payment
    FROM notarized_payments
    WHERE quote_id = p_quote_id 
      AND idempotency_key = p_idempotency_key
    LIMIT 1;
    
    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'payment_id', v_existing_payment.id,
        'status', v_existing_payment.status,
        'amount_minor', v_existing_payment.amount_minor,
        'currency', v_existing_payment.currency,
        'checkout_url', NULL  -- Would be populated by provider
      );
    END IF;
  END IF;
  
  -- Check for any existing pending payment
  SELECT * INTO v_existing_payment
  FROM notarized_payments
  WHERE quote_id = p_quote_id AND status = 'pending'
  LIMIT 1;
  
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'existing', true,
      'payment_id', v_existing_payment.id,
      'status', v_existing_payment.status,
      'amount_minor', v_existing_payment.amount_minor,
      'currency', v_existing_payment.currency,
      'checkout_url', NULL
    );
  END IF;
  
  -- Convert to minor units using the standard function
  v_amount_minor := to_payment_minor_units(v_currency, v_quote.total_amount);
  
  -- Validate amount
  IF v_amount_minor <= 0 THEN
    RETURN jsonb_build_object('error', 'Invalid payment amount', 'code', 'INVALID_AMOUNT');
  END IF;
  
  -- Create payment record
  v_payment_id := gen_random_uuid();
  
  INSERT INTO notarized_payments (
    id,
    quote_id,
    amount_minor,
    currency,
    status,
    idempotency_key
  ) VALUES (
    v_payment_id,
    p_quote_id,
    v_amount_minor,
    v_currency,
    'pending',
    p_idempotency_key
  );
  
  -- Return payment details for UI
  -- In production, this would include checkout_url from Stripe
  RETURN jsonb_build_object(
    'ok', true,
    'payment_id', v_payment_id,
    'amount_minor', v_amount_minor,
    'amount_major', v_quote.total_amount,
    'currency', v_currency,
    'status', 'pending',
    'checkout_url', NULL,  -- Placeholder: edge function will create Stripe session
    'client_secret', NULL  -- Placeholder: for PaymentIntent flow
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) Ensure unique constraint for idempotency
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'notarized_payment_provider_events_provider_event_unique'
  ) THEN
    ALTER TABLE public.notarized_payment_provider_events
    ADD CONSTRAINT notarized_payment_provider_events_provider_event_unique 
    UNIQUE (provider, provider_event_id);
  END IF;
END $$;

-- 5) Grant execute to authenticated users (not public)
REVOKE ALL ON FUNCTION public.rpc_notarized_payment_start(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_notarized_payment_start(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.to_payment_minor_units(TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.to_payment_minor_units(TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.to_payment_minor_units(TEXT, NUMERIC) TO service_role;