
-- Fix: Make quote accept idempotent - return success if already accepted
CREATE OR REPLACE FUNCTION public.rpc_translation_quote_accept(p_quote_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_quote RECORD;
  v_order_id UUID;
  v_jobs_locked INT;
BEGIN
  SELECT * INTO v_quote FROM notarized_translation_quotes WHERE id = p_quote_id;
  
  IF v_quote IS NULL THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;
  
  -- IDEMPOTENT: If already accepted, return success without error
  IF v_quote.status = 'accepted' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'quote_id', p_quote_id,
      'order_id', v_quote.order_id,
      'already_accepted', true
    );
  END IF;
  
  -- Check for other terminal statuses
  IF v_quote.status NOT IN ('pending', 'accepted') THEN
    RAISE EXCEPTION 'Quote is %', v_quote.status;
  END IF;
  
  IF v_quote.expires_at < now() THEN
    UPDATE notarized_translation_quotes SET status = 'expired' WHERE id = p_quote_id;
    RAISE EXCEPTION 'Quote has expired';
  END IF;
  
  v_order_id := v_quote.order_id;
  
  -- Accept quote
  UPDATE notarized_translation_quotes
  SET status = 'accepted', accepted_at = now()
  WHERE id = p_quote_id;
  
  -- Update order
  UPDATE notarized_translation_orders
  SET status = 'awaiting_payment', updated_at = now()
  WHERE id = v_order_id;
  
  -- CRITICAL: Lock page_count on ALL jobs (CONTRACT PROTECTION)
  UPDATE notarized_translation_jobs
  SET 
    status = 'awaiting_payment',
    page_count_locked = true,
    page_count_locked_at = now(),
    updated_at = now()
  WHERE order_id = v_order_id;
  
  GET DIAGNOSTICS v_jobs_locked = ROW_COUNT;
  
  -- Log event
  INSERT INTO notarized_translation_events (order_id, event_type, new_status, actor_type, meta)
  VALUES (
    v_order_id, 'quote_accepted', 'awaiting_payment', 'customer',
    jsonb_build_object('quote_id', p_quote_id, 'jobs_locked', v_jobs_locked)
  );
  
  RETURN jsonb_build_object(
    'ok', true,
    'quote_id', p_quote_id,
    'order_id', v_order_id,
    'jobs_locked', v_jobs_locked,
    'page_count_frozen', true
  );
END;
$function$;
