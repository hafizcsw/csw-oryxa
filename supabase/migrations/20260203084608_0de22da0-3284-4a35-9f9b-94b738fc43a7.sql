-- DROP and recreate with correct logic

-- Drop existing versions
DROP FUNCTION IF EXISTS public.rpc_notarized_job_set_precheck(uuid, boolean, integer, numeric, text[], text, numeric, text, text[], text[]);

-- Create with page_count_locked logic
CREATE OR REPLACE FUNCTION public.rpc_notarized_job_set_precheck(
  p_job_id UUID,
  p_ok BOOLEAN,
  p_page_count INT,
  p_quality_score NUMERIC,
  p_quality_flags TEXT[],
  p_doc_type_guess TEXT,
  p_doc_type_confidence NUMERIC,
  p_rejection_code TEXT,
  p_rejection_reasons TEXT[],
  p_fix_tips TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_order_id UUID;
  v_all_jobs_checked BOOLEAN;
  v_all_passed BOOLEAN;
  v_new_status TEXT;
  v_is_locked BOOLEAN;
  v_actual_page_count INT;
BEGIN
  -- Get job and check lock status
  SELECT * INTO v_job FROM notarized_translation_jobs WHERE id = p_job_id;
  
  IF v_job IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;
  
  v_order_id := v_job.order_id;
  v_is_locked := COALESCE(v_job.page_count_locked, false);
  
  -- CRITICAL: If page_count is locked, do NOT update it (contract protection)
  IF v_is_locked THEN
    v_actual_page_count := v_job.page_count;
  ELSE
    v_actual_page_count := COALESCE(p_page_count, 1);
  END IF;
  
  -- Determine status
  IF p_ok THEN
    v_new_status := 'precheck_passed';
  ELSE
    v_new_status := 'precheck_rejected';
  END IF;
  
  -- Update job
  UPDATE notarized_translation_jobs
  SET 
    status = v_new_status,
    page_count = v_actual_page_count,
    quality_score = p_quality_score,
    quality_flags = p_quality_flags,
    doc_type_guess = p_doc_type_guess,
    doc_type_confidence = p_doc_type_confidence,
    rejection_code = CASE WHEN p_ok THEN NULL ELSE p_rejection_code END,
    rejection_reasons = CASE WHEN p_ok THEN NULL ELSE p_rejection_reasons END,
    fix_tips = CASE WHEN p_ok THEN NULL ELSE p_fix_tips END,
    updated_at = now()
  WHERE id = p_job_id;
  
  -- Check if all jobs for this order have been checked
  SELECT 
    NOT EXISTS(SELECT 1 FROM notarized_translation_jobs 
               WHERE order_id = v_order_id AND status = 'awaiting_precheck'),
    NOT EXISTS(SELECT 1 FROM notarized_translation_jobs 
               WHERE order_id = v_order_id AND status = 'precheck_rejected')
  INTO v_all_jobs_checked, v_all_passed;
  
  -- Update order status if all jobs checked
  IF v_all_jobs_checked THEN
    IF v_all_passed THEN
      UPDATE notarized_translation_orders
      SET status = 'awaiting_quote', updated_at = now()
      WHERE id = v_order_id AND status IN ('awaiting_precheck', 'awaiting_upload');
    ELSE
      UPDATE notarized_translation_orders
      SET status = 'precheck_rejected', updated_at = now()
      WHERE id = v_order_id AND status = 'awaiting_precheck';
    END IF;
  END IF;
  
  -- Log event
  INSERT INTO notarized_translation_events (job_id, order_id, event_type, new_status, actor_type, meta)
  VALUES (
    p_job_id, v_order_id,
    CASE WHEN p_ok THEN 'precheck_pass' ELSE 'precheck_reject' END,
    v_new_status, 'system',
    jsonb_build_object(
      'quality_score', p_quality_score, 
      'page_count', v_actual_page_count, 
      'page_count_was_locked', v_is_locked,
      'rejection_code', p_rejection_code
    )
  );
  
  RETURN jsonb_build_object(
    'ok', true, 
    'status', v_new_status, 
    'page_count_used', v_actual_page_count,
    'page_count_was_locked', v_is_locked,
    'all_passed', v_all_passed
  );
END;
$$;

-- Drop and recreate quote accept with locking
DROP FUNCTION IF EXISTS public.rpc_translation_quote_accept(uuid);

CREATE FUNCTION public.rpc_translation_quote_accept(p_quote_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote RECORD;
  v_order_id UUID;
  v_jobs_locked INT;
BEGIN
  SELECT * INTO v_quote FROM notarized_translation_quotes WHERE id = p_quote_id;
  
  IF v_quote IS NULL THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;
  
  IF v_quote.status != 'pending' THEN
    RAISE EXCEPTION 'Quote already %', v_quote.status;
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
$$;

-- Drop and recreate quote create with pricing snapshot
DROP FUNCTION IF EXISTS public.rpc_translation_quote_create(uuid);

CREATE FUNCTION public.rpc_translation_quote_create(p_order_id UUID)
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
    -- Get pricing rule
    SELECT * INTO v_pricing 
    FROM notarized_pricing_rules 
    WHERE doc_type ILIKE '%' || v_job.doc_slot || '%' 
       OR doc_type = 'default'
    ORDER BY CASE WHEN doc_type = 'default' THEN 1 ELSE 0 END
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.rpc_notarized_job_set_precheck TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_translation_quote_create TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_translation_quote_accept TO authenticated;