-- FIX: Quote breakdown JSON array append (use jsonb_build_array for proper array concatenation)
-- This ensures line_items is always a proper JSON array

CREATE OR REPLACE FUNCTION public.rpc_translation_quote_create(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_job record;
  v_pricing record;
  v_line_items jsonb := '[]'::jsonb;
  v_total_amount numeric := 0;
  v_line_total numeric;
  v_extra_pages int;
  v_quote_id uuid;
BEGIN
  -- Get order and verify status
  SELECT * INTO v_order 
  FROM notarized_translation_orders 
  WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Order not found');
  END IF;
  
  IF v_order.status != 'awaiting_quote' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Order not in awaiting_quote status');
  END IF;
  
  -- Expire any previous presented quotes for this order
  UPDATE notarized_translation_quotes
  SET status = 'expired'
  WHERE order_id = p_order_id AND status = 'presented';
  
  -- Calculate pricing for each job
  FOR v_job IN 
    SELECT * FROM notarized_translation_jobs WHERE order_id = p_order_id
  LOOP
    -- Get pricing rules for this doc_slot
    SELECT * INTO v_pricing
    FROM notarized_pricing_rules
    WHERE doc_slot = v_job.doc_slot AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Fallback to default pricing if not found
    IF NOT FOUND THEN
      SELECT * INTO v_pricing
      FROM notarized_pricing_rules
      WHERE doc_slot = 'default' AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1;
    END IF;
    
    -- Use hardcoded defaults if still not found
    IF NOT FOUND THEN
      v_pricing := ROW(
        'default'::text, 'USD'::text, 50.00::numeric, 15.00::numeric, 0.00::numeric, true, now()
      )::notarized_pricing_rules;
    END IF;
    
    -- Calculate: base_fee + max(page_count - 1, 0) * extra_page_fee
    v_extra_pages := GREATEST(COALESCE(v_job.page_count, 1) - 1, 0);
    v_line_total := v_pricing.base_fee + (v_extra_pages * v_pricing.extra_page_fee) + COALESCE(v_pricing.complexity_surcharge, 0);
    v_total_amount := v_total_amount + v_line_total;
    
    -- FIX: Properly append to JSON array using jsonb_build_array
    v_line_items := v_line_items || jsonb_build_array(
      jsonb_build_object(
        'job_id', v_job.id,
        'doc_slot', v_job.doc_slot,
        'page_count', COALESCE(v_job.page_count, 1),
        'base_fee', v_pricing.base_fee,
        'extra_pages', v_extra_pages,
        'extra_page_fee', v_pricing.extra_page_fee,
        'complexity_surcharge', COALESCE(v_pricing.complexity_surcharge, 0),
        'line_total', v_line_total
      )
    );
  END LOOP;
  
  -- Insert new quote
  INSERT INTO notarized_translation_quotes (
    order_id, currency, total_amount, breakdown_json, status, expires_at
  ) VALUES (
    p_order_id, 
    COALESCE(v_pricing.currency, 'USD'), 
    v_total_amount, 
    jsonb_build_object(
      'line_items', v_line_items,
      'currency', COALESCE(v_pricing.currency, 'USD'),
      'total', v_total_amount,
      'calculated_at', now()
    ),
    'presented',
    now() + interval '24 hours'
  )
  RETURNING id INTO v_quote_id;
  
  -- Update order status
  UPDATE notarized_translation_orders
  SET status = 'quote_presented'
  WHERE id = p_order_id;
  
  -- Log event
  INSERT INTO notarized_translation_events (order_id, event_type, payload)
  VALUES (p_order_id, 'quote_created', jsonb_build_object(
    'quote_id', v_quote_id,
    'total_amount', v_total_amount,
    'line_items_count', jsonb_array_length(v_line_items)
  ));
  
  RETURN jsonb_build_object(
    'ok', true,
    'quote_id', v_quote_id,
    'total_amount', v_total_amount,
    'breakdown', v_line_items,
    'currency', COALESCE(v_pricing.currency, 'USD')
  );
END;
$$;

-- Also create canonical wrapper
CREATE OR REPLACE FUNCTION public.rpc_notarized_quote_create(p_order_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.rpc_translation_quote_create(p_order_id);
$$;