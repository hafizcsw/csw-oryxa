-- Fix: rpc_notarized_apply_payment_event should enqueue ALL jobs for the order, not pass order_id as job_id

CREATE OR REPLACE FUNCTION public.rpc_notarized_apply_payment_event(
    p_provider text,
    p_provider_event_id text,
    p_event_type text,
    p_payment_id uuid,
    p_status text,
    p_provider_payment_id text DEFAULT NULL,
    p_raw_payload jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing_event RECORD;
    v_payment RECORD;
    v_job RECORD;
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

        -- FIX: Enqueue ALL jobs for this order (not pass order_id as job_id)
        FOR v_job IN 
            SELECT id FROM notarized_translation_jobs 
            WHERE order_id = v_payment.order_id
        LOOP
            PERFORM rpc_notarized_job_enqueue(v_job.id);
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', p_payment_id,
        'status', p_status,
        'idempotent', false
    );
END;
$$;