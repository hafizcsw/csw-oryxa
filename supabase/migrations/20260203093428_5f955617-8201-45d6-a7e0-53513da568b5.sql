
-- Fix RPC to use correct column name (total_amount not total_cents)
CREATE OR REPLACE FUNCTION public.rpc_notarized_payment_start(
  p_quote_id UUID,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote RECORD;
  v_existing_payment RECORD;
  v_payment_id UUID;
BEGIN
  -- Get quote and validate
  SELECT q.*, o.customer_id, o.status AS order_status
  INTO v_quote
  FROM notarized_translation_quotes q
  JOIN notarized_translation_orders o ON o.id = q.order_id
  WHERE q.id = p_quote_id;
  
  IF v_quote IS NULL THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;
  
  -- Quote must be accepted
  IF v_quote.status != 'accepted' THEN
    RAISE EXCEPTION 'Quote must be accepted before payment. Current status: %', v_quote.status;
  END IF;
  
  -- Check if quote expired
  IF v_quote.expires_at IS NOT NULL AND v_quote.expires_at < now() THEN
    RAISE EXCEPTION 'Quote has expired';
  END IF;
  
  -- Check for existing pending payment with same idempotency key
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing_payment 
    FROM notarized_payments 
    WHERE idempotency_key = p_idempotency_key;
    
    IF v_existing_payment IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', true,
        'payment_id', v_existing_payment.id,
        'status', v_existing_payment.status,
        'idempotent', true
      );
    END IF;
  END IF;
  
  -- Check for existing non-failed payment for this quote
  SELECT * INTO v_existing_payment
  FROM notarized_payments
  WHERE quote_id = p_quote_id AND status NOT IN ('failed', 'cancelled');
  
  IF v_existing_payment IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'payment_id', v_existing_payment.id,
      'status', v_existing_payment.status,
      'existing', true
    );
  END IF;
  
  -- Create new payment (use total_amount instead of total_cents)
  INSERT INTO notarized_payments (
    quote_id, order_id, amount_cents, currency, 
    provider, status, idempotency_key
  )
  VALUES (
    p_quote_id, v_quote.order_id, v_quote.total_amount, v_quote.currency,
    'stripe', 'pending', p_idempotency_key
  )
  RETURNING id INTO v_payment_id;
  
  -- Log event
  INSERT INTO notarized_translation_events (
    order_id, event_type, new_status, actor_type, meta
  )
  VALUES (
    v_quote.order_id, 'payment_started', 'pending', 'system',
    jsonb_build_object('payment_id', v_payment_id, 'amount_cents', v_quote.total_amount)
  );
  
  RETURN jsonb_build_object(
    'ok', true,
    'payment_id', v_payment_id,
    'amount_cents', v_quote.total_amount,
    'currency', v_quote.currency,
    'status', 'pending'
  );
END;
$$;
