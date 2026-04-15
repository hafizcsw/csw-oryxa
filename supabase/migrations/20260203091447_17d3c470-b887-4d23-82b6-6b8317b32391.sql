CREATE OR REPLACE FUNCTION public.rpc_translation_quote_create(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_job RECORD;
  v_line_items JSONB := '[]'::jsonb;
  v_pricing_snapshot JSONB := '[]'::jsonb;
  v_total NUMERIC := 0;
  v_quote_id UUID;
  v_pricing RECORD;
  v_line_total NUMERIC;
  v_extra_pages INT;
  v_base_fee NUMERIC;
  v_extra_page_fee NUMERIC;
  v_complexity_surcharge NUMERIC;
BEGIN
  SELECT * INTO v_order FROM notarized_translation_orders WHERE id = p_order_id;
  
  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  
  IF v_order.status NOT IN ('awaiting_quote', 'quote_presented') THEN
    RAISE EXCEPTION 'Order not in correct status for quote: %', v_order.status;
  END IF;
  
  FOR v_job IN SELECT * FROM notarized_translation_jobs WHERE order_id = p_order_id
  LOOP
    -- Get pricing rule (FIXED: use doc_slot instead of doc_type)
    SELECT * INTO v_pricing 
    FROM notarized_pricing_rules 
    WHERE doc_slot ILIKE '%' || v_job.doc_slot || '%' 
       OR doc_slot = 'default'
    ORDER BY CASE WHEN doc_slot = 'default' THEN 1 ELSE 0 END
    LIMIT 1;
    
    v_base_fee := COALESCE(v_pricing.base_fee, 50);
    v_extra_page_fee := COALESCE(v_pricing.extra_page_fee, 15);
    v_complexity_surcharge := COALESCE(v_pricing.complexity_surcharge, 0);
    
    -- Calculate: first page in base, extra pages separate
    v_extra_pages := GREATEST(COALESCE(v_job.page_count, 1) - 1, 0);
    v_line_total := v_base_fee + (v_extra_pages * v_extra_page_fee) + v_complexity_surcharge;
    v_total := v_total + v_line_total;
    
    -- Build line item (PROPER ARRAY APPEND)
    v_line_items := v_line_items || jsonb_build_array(jsonb_build_object(
      'job_id', v_job.id,
      'doc_slot', v_job.doc_slot,
      'page_count', COALESCE(v_job.page_count, 1),
      'base_fee', v_base_fee,
      'extra_pages', v_extra_pages,
      'extra_page_fee', v_extra_page_fee,
      'complexity_surcharge', v_complexity_surcharge,
      'line_total', v_line_total
    ));
    
    -- Build pricing snapshot
    v_pricing_snapshot := v_pricing_snapshot || jsonb_build_array(jsonb_build_object(
      'job_id', v_job.id,
      'doc_slot', v_job.doc_slot,
      'rule_id', v_pricing.id,
      'base_fee_at_quote', v_base_fee,
      'extra_page_fee_at_quote', v_extra_page_fee,
      'complexity_surcharge_at_quote', v_complexity_surcharge
    ));
  END LOOP;
  
  -- Create quote with schema version and pricing snapshot
  INSERT INTO notarized_translation_quotes (
    order_id,
    breakdown_json,
    total_amount,
    currency,
    status,
    schema_version,
    pricing_snapshot_json,
    expires_at
  ) VALUES (
    p_order_id,
    jsonb_build_object(
      'schema_version', 1,
      'line_items', v_line_items,
      'total', v_total
    ),
    v_total,
    'USD',
    'pending',
    1,
    v_pricing_snapshot,
    now() + interval '24 hours'
  )
  RETURNING id INTO v_quote_id;
  
  -- Update order
  UPDATE notarized_translation_orders
  SET status = 'quote_presented', updated_at = now()
  WHERE id = p_order_id;
  
  -- Log event
  INSERT INTO notarized_translation_events (order_id, event_type, new_status, actor_type, meta)
  VALUES (
    p_order_id, 'quote_created', 'quote_presented', 'system',
    jsonb_build_object('quote_id', v_quote_id, 'total', v_total)
  );
  
  RETURN jsonb_build_object(
    'ok', true,
    'quote_id', v_quote_id,
    'total', v_total,
    'line_items_count', jsonb_array_length(v_line_items),
    'schema_version', 1
  );
END;
$$;