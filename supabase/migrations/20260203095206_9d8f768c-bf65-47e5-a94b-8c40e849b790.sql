
-- Sprint B Critical Fixes: Evidence Pack Requirements (Retry without duplicate constraint)

-- E-B1 FIX: Rename amount_cents to amount_minor in ledger
ALTER TABLE public.notarized_ledger 
RENAME COLUMN amount_cents TO amount_minor;

-- E-B1 FIX: Update amount_major to support 3 decimals (for KWD etc)
ALTER TABLE public.notarized_payments 
ALTER COLUMN amount_major TYPE NUMERIC(12, 3);

-- E-B4 FIX: Update RPC to use auth.uid() for ownership check
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
    v_user_id UUID;
    v_quote RECORD;
    v_payment RECORD;
    v_amount_minor INTEGER;
BEGIN
    -- E-B4: Get authenticated user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('error', 'Authentication required', 'code', 'AUTH_REQUIRED');
    END IF;

    -- Get quote with lock
    SELECT q.*, o.id as order_id, o.customer_id, o.status as order_status
    INTO v_quote
    FROM notarized_translation_quotes q
    JOIN notarized_translation_orders o ON o.id = q.order_id
    WHERE q.id = p_quote_id
    FOR UPDATE OF q, o;

    IF v_quote IS NULL THEN
        RETURN jsonb_build_object('error', 'Quote not found', 'code', 'NOT_FOUND');
    END IF;

    -- E-B4: Ownership check - user must own the order
    IF v_quote.customer_id != v_user_id THEN
        RETURN jsonb_build_object('error', 'Not authorized to pay for this quote', 'code', 'NOT_OWNER');
    END IF;

    -- Check quote is accepted
    IF v_quote.status != 'accepted' THEN
        RETURN jsonb_build_object('error', 'Quote must be accepted first', 'code', 'INVALID_STATUS');
    END IF;

    -- Check for existing pending payment (idempotency)
    SELECT * INTO v_payment
    FROM notarized_payments
    WHERE quote_id = p_quote_id
    AND status = 'pending'
    LIMIT 1;

    IF v_payment IS NOT NULL THEN
        RETURN jsonb_build_object(
            'payment_id', v_payment.id,
            'amount_minor', v_payment.amount_minor,
            'amount_major', v_payment.amount_major,
            'currency', v_payment.currency,
            'status', v_payment.status,
            'idempotent', true
        );
    END IF;

    -- Convert to minor units
    v_amount_minor := public.to_payment_minor_units(v_quote.currency, v_quote.total_amount);

    -- Create new payment record
    INSERT INTO notarized_payments (
        quote_id,
        order_id,
        amount_minor,
        amount_major,
        currency,
        provider,
        status,
        idempotency_key
    ) VALUES (
        p_quote_id,
        v_quote.order_id,
        v_amount_minor,
        v_quote.total_amount,
        v_quote.currency,
        'stripe',
        'pending',
        COALESCE(p_idempotency_key, gen_random_uuid()::text)
    )
    RETURNING * INTO v_payment;

    UPDATE notarized_translation_orders
    SET status = 'awaiting_payment', updated_at = now()
    WHERE id = v_quote.order_id;

    RETURN jsonb_build_object(
        'payment_id', v_payment.id,
        'amount_minor', v_payment.amount_minor,
        'amount_major', v_payment.amount_major,
        'currency', v_payment.currency,
        'status', v_payment.status,
        'checkout_url', NULL,
        'client_secret', NULL
    );
END;
$$;

-- E-B2 FIX: Update apply payment event RPC with proper idempotency handling
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
    v_existing_event RECORD;
    v_payment RECORD;
BEGIN
    -- E-B2: Check for existing event FIRST (idempotency)
    SELECT * INTO v_existing_event
    FROM notarized_payment_provider_events
    WHERE provider = p_provider 
    AND provider_event_id = p_provider_event_id;

    IF v_existing_event IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'message', 'Event already processed',
            'event_id', v_existing_event.id
        );
    END IF;

    -- Insert event record (unique constraint catches race)
    BEGIN
        INSERT INTO notarized_payment_provider_events (
            payment_id, provider, provider_event_id, event_type, raw_payload, processed_at
        ) VALUES (
            p_payment_id, p_provider, p_provider_event_id, p_event_type, p_raw_payload, now()
        );
    EXCEPTION WHEN unique_violation THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'message', 'Event processed by concurrent request'
        );
    END;

    -- Get payment with lock
    SELECT * INTO v_payment
    FROM notarized_payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF v_payment IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payment not found');
    END IF;

    -- Update payment status
    UPDATE notarized_payments
    SET 
        status = p_status,
        provider_payment_id = COALESCE(p_provider_payment_id, provider_payment_id),
        paid_at = CASE WHEN p_status = 'succeeded' THEN now() ELSE paid_at END,
        updated_at = now()
    WHERE id = p_payment_id;

    -- If succeeded, update order and create ledger entry
    IF p_status = 'succeeded' THEN
        UPDATE notarized_translation_orders
        SET status = 'paid', updated_at = now()
        WHERE id = v_payment.order_id;

        INSERT INTO notarized_ledger (
            order_id, payment_id, quote_id, entry_type, amount_minor, currency,
            debit_account, credit_account, description
        ) VALUES (
            v_payment.order_id, v_payment.id, v_payment.quote_id, 'payment_received',
            v_payment.amount_minor, v_payment.currency, 'customer', 'revenue',
            'Payment received via ' || p_provider
        );

        PERFORM rpc_notarized_job_enqueue(v_payment.order_id);
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', p_payment_id,
        'status', p_status,
        'idempotent', false
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_notarized_payment_start(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_notarized_apply_payment_event(TEXT, TEXT, TEXT, UUID, TEXT, TEXT, JSONB) TO service_role;
