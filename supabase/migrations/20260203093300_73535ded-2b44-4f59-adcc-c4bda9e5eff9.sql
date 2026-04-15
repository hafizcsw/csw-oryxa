
-- ============================================================
-- SPRINT B2/B3/B4: Payment RPCs
-- ============================================================

-- B2: rpc_notarized_payment_start - Create payment session
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
  v_order RECORD;
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
      -- Return existing payment (idempotent)
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
  
  -- Create new payment
  INSERT INTO notarized_payments (
    quote_id, order_id, amount_cents, currency, 
    provider, status, idempotency_key
  )
  VALUES (
    p_quote_id, v_quote.order_id, v_quote.total_cents, v_quote.currency,
    'stripe', 'pending', p_idempotency_key
  )
  RETURNING id INTO v_payment_id;
  
  -- Log event
  INSERT INTO notarized_translation_events (
    order_id, event_type, new_status, actor_type, meta
  )
  VALUES (
    v_quote.order_id, 'payment_started', 'pending', 'system',
    jsonb_build_object('payment_id', v_payment_id, 'amount_cents', v_quote.total_cents)
  );
  
  RETURN jsonb_build_object(
    'ok', true,
    'payment_id', v_payment_id,
    'amount_cents', v_quote.total_cents,
    'currency', v_quote.currency,
    'status', 'pending'
  );
END;
$$;

-- B4: rpc_notarized_apply_payment_event - Process webhook event (idempotent)
CREATE OR REPLACE FUNCTION public.rpc_notarized_apply_payment_event(
  p_provider TEXT,
  p_provider_event_id TEXT,
  p_event_type TEXT,
  p_payment_id UUID,
  p_status TEXT,
  p_provider_payment_id TEXT DEFAULT NULL,
  p_raw_payload JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
  v_existing_event RECORD;
  v_order_id UUID;
BEGIN
  -- IDEMPOTENCY CHECK: Has this event been processed before?
  SELECT * INTO v_existing_event
  FROM notarized_payment_provider_events
  WHERE provider = p_provider AND provider_event_id = p_provider_event_id;
  
  IF v_existing_event IS NOT NULL THEN
    -- Event already processed - return success (idempotent)
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'message', 'Event already processed'
    );
  END IF;
  
  -- Get payment
  SELECT * INTO v_payment FROM notarized_payments WHERE id = p_payment_id;
  
  IF v_payment IS NULL THEN
    RAISE EXCEPTION 'Payment not found: %', p_payment_id;
  END IF;
  
  v_order_id := v_payment.order_id;
  
  -- Record the event FIRST (for idempotency)
  INSERT INTO notarized_payment_provider_events (
    payment_id, provider, provider_event_id, event_type, raw_payload
  )
  VALUES (
    p_payment_id, p_provider, p_provider_event_id, p_event_type, p_raw_payload
  );
  
  -- Process based on status
  IF p_status = 'succeeded' THEN
    -- Update payment
    UPDATE notarized_payments
    SET 
      status = 'succeeded',
      provider_payment_id = COALESCE(p_provider_payment_id, provider_payment_id),
      paid_at = now(),
      updated_at = now()
    WHERE id = p_payment_id;
    
    -- Update order status to paid
    UPDATE notarized_translation_orders
    SET status = 'paid', updated_at = now()
    WHERE id = v_order_id;
    
    -- Update all jobs to paid
    UPDATE notarized_translation_jobs
    SET status = 'paid', updated_at = now()
    WHERE order_id = v_order_id AND status = 'awaiting_payment';
    
    -- Create ledger entry
    INSERT INTO notarized_ledger (
      order_id, payment_id, quote_id, entry_type,
      amount_cents, currency, debit_account, credit_account,
      description, meta
    )
    VALUES (
      v_order_id, p_payment_id, v_payment.quote_id, 'charge',
      v_payment.amount_cents, v_payment.currency, 'customer', 'revenue',
      'Payment received for translation order',
      jsonb_build_object('provider', p_provider, 'provider_payment_id', p_provider_payment_id)
    );
    
    -- Log event
    INSERT INTO notarized_translation_events (
      order_id, event_type, new_status, actor_type, meta
    )
    VALUES (
      v_order_id, 'payment_succeeded', 'paid', 'system',
      jsonb_build_object('payment_id', p_payment_id, 'amount_cents', v_payment.amount_cents)
    );
    
    -- Enqueue jobs for processing (only paid jobs with valid uploads)
    UPDATE notarized_translation_jobs
    SET 
      status = 'processing_ocr',
      updated_at = now()
    WHERE order_id = v_order_id 
      AND status = 'paid'
      AND original_path IS NOT NULL
      AND COALESCE(quality_score, 0) >= 0.5;
    
  ELSIF p_status = 'failed' THEN
    -- Update payment to failed
    UPDATE notarized_payments
    SET status = 'failed', updated_at = now()
    WHERE id = p_payment_id;
    
    -- Log event
    INSERT INTO notarized_translation_events (
      order_id, event_type, new_status, actor_type, meta
    )
    VALUES (
      v_order_id, 'payment_failed', 'failed', 'system',
      jsonb_build_object('payment_id', p_payment_id, 'reason', p_raw_payload->'failure_reason')
    );
    
  ELSIF p_status = 'refunded' THEN
    -- Update payment to refunded
    UPDATE notarized_payments
    SET status = 'refunded', updated_at = now()
    WHERE id = p_payment_id;
    
    -- Create refund ledger entry
    INSERT INTO notarized_ledger (
      order_id, payment_id, quote_id, entry_type,
      amount_cents, currency, debit_account, credit_account,
      description, meta
    )
    VALUES (
      v_order_id, p_payment_id, v_payment.quote_id, 'refund',
      -v_payment.amount_cents, v_payment.currency, 'revenue', 'customer',
      'Refund issued',
      jsonb_build_object('provider', p_provider)
    );
    
    -- Log event
    INSERT INTO notarized_translation_events (
      order_id, event_type, new_status, actor_type, meta
    )
    VALUES (
      v_order_id, 'payment_refunded', 'refunded', 'system',
      jsonb_build_object('payment_id', p_payment_id)
    );
  END IF;
  
  RETURN jsonb_build_object(
    'ok', true,
    'status', p_status,
    'payment_id', p_payment_id,
    'order_id', v_order_id
  );
END;
$$;

-- Revoke public access to these RPCs (service role only for webhook)
REVOKE EXECUTE ON FUNCTION public.rpc_notarized_apply_payment_event FROM PUBLIC;
