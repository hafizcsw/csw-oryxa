-- Fix rpc_translation_quote_accept to use valid status 'awaiting_payment' instead of 'quoted'
DROP FUNCTION IF EXISTS public.rpc_translation_quote_accept(uuid);

CREATE FUNCTION public.rpc_translation_quote_accept(p_quote_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote record;
  v_order record;
BEGIN
  -- Get quote
  SELECT * INTO v_quote
  FROM notarized_translation_quotes
  WHERE id = p_quote_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;

  -- Check if already accepted (idempotent)
  IF v_quote.status = 'accepted' THEN
    RETURN;
  END IF;

  -- Check for valid statuses that can be accepted
  IF v_quote.status NOT IN ('pending', 'presented', 'accepted') THEN
    RAISE EXCEPTION 'Quote is %', v_quote.status;
  END IF;

  -- Get the order
  SELECT * INTO v_order
  FROM notarized_translation_orders
  WHERE id = v_quote.order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Update quote status to accepted
  UPDATE notarized_translation_quotes
  SET status = 'accepted',
      accepted_at = now()
  WHERE id = p_quote_id;

  -- Update order status to awaiting_payment (valid status per check constraint)
  UPDATE notarized_translation_orders
  SET status = 'awaiting_payment'
  WHERE id = v_quote.order_id;

  -- Log event
  INSERT INTO notarized_translation_events (order_id, event_type, old_status, new_status, meta)
  VALUES (v_quote.order_id, 'quote_accepted', v_order.status, 'awaiting_payment', jsonb_build_object('quote_id', p_quote_id));
END;
$$;