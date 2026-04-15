
-- Fix: Remove amount_major from INSERT since it's a GENERATED column
CREATE OR REPLACE FUNCTION public.rpc_notarized_payment_start(p_quote_id uuid, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    -- Create new payment record (amount_major is auto-computed from amount_minor)
    INSERT INTO notarized_payments (
        quote_id,
        order_id,
        amount_minor,
        currency,
        provider,
        status,
        idempotency_key
    ) VALUES (
        p_quote_id,
        v_quote.order_id,
        v_amount_minor,
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
$function$;
