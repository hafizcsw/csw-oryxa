
-- FIX A2: Update RPC to use valid statuses from constraint
-- Valid statuses: awaiting_upload, awaiting_precheck, precheck_rejected, awaiting_quote, 
--                 awaiting_payment, paid, processing_ocr, processing_extract, 
--                 processing_translate, processing_render, draft_ready, failed, purged

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
  
  -- Determine status - FIX: Use VALID statuses from constraint
  -- precheck_passed does NOT exist, use awaiting_quote instead when passed
  IF p_ok THEN
    v_new_status := 'awaiting_quote';  -- FIXED: Valid status
  ELSE
    v_new_status := 'precheck_rejected';  -- This exists in constraint
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
