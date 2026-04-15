-- ============================================
-- NOTARIZED TRANSLATION RPCs
-- ============================================

-- 1. Create Order with Jobs
CREATE OR REPLACE FUNCTION public.rpc_notarized_order_create(
  p_customer_id UUID,
  p_delivery_mode TEXT DEFAULT 'digital',
  p_notify_channels TEXT[] DEFAULT ARRAY['email'],
  p_doc_slots TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_job_ids UUID[] := ARRAY[]::UUID[];
  v_slot TEXT;
  v_job_id UUID;
BEGIN
  -- Create order
  INSERT INTO notarized_translation_orders (
    customer_id, delivery_mode, notify_channels, doc_slots, status
  ) VALUES (
    p_customer_id, p_delivery_mode, p_notify_channels, p_doc_slots, 'awaiting_upload'
  ) RETURNING id INTO v_order_id;
  
  -- Create jobs for each slot
  FOREACH v_slot IN ARRAY p_doc_slots LOOP
    INSERT INTO notarized_translation_jobs (order_id, doc_slot, status)
    VALUES (v_order_id, v_slot, 'awaiting_upload')
    RETURNING id INTO v_job_id;
    
    v_job_ids := array_append(v_job_ids, v_job_id);
    
    -- Log event
    INSERT INTO notarized_translation_events (job_id, order_id, event_type, new_status, actor_type)
    VALUES (v_job_id, v_order_id, 'job_created', 'awaiting_upload', 'system');
  END LOOP;
  
  RETURN jsonb_build_object('order_id', v_order_id, 'job_ids', v_job_ids);
END;
$$;

-- 2. Generate presigned upload URL (returns path for client to use)
CREATE OR REPLACE FUNCTION public.rpc_notarized_presign_upload(
  p_order_id UUID,
  p_job_id UUID,
  p_ext TEXT,
  p_content_type TEXT DEFAULT 'application/octet-stream'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_object_path TEXT;
BEGIN
  -- Verify ownership
  SELECT customer_id INTO v_customer_id
  FROM notarized_translation_orders
  WHERE id = p_order_id;
  
  IF v_customer_id IS NULL OR v_customer_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  -- Build path: {customer_id}/{order_id}/{job_id}/original.{ext}
  v_object_path := v_customer_id::text || '/' || p_order_id::text || '/' || p_job_id::text || '/original.' || p_ext;
  
  RETURN jsonb_build_object(
    'bucket', 'notarized_originals',
    'object_path', v_object_path,
    'content_type', p_content_type
  );
END;
$$;

-- 3. Mark upload complete
CREATE OR REPLACE FUNCTION public.rpc_notarized_upload_complete(
  p_job_id UUID,
  p_original_path TEXT,
  p_original_meta JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_customer_id UUID;
BEGIN
  -- Get order and verify
  SELECT j.order_id, o.customer_id INTO v_order_id, v_customer_id
  FROM notarized_translation_jobs j
  JOIN notarized_translation_orders o ON j.order_id = o.id
  WHERE j.id = p_job_id;
  
  IF v_customer_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  -- Update job
  UPDATE notarized_translation_jobs
  SET 
    original_path = p_original_path,
    original_meta = p_original_meta,
    status = 'awaiting_precheck',
    updated_at = NOW()
  WHERE id = p_job_id;
  
  -- Log event
  INSERT INTO notarized_translation_events (job_id, order_id, event_type, old_status, new_status, actor_type, meta)
  VALUES (p_job_id, v_order_id, 'upload_complete', 'awaiting_upload', 'awaiting_precheck', 'customer', p_original_meta);
  
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 4. Set precheck result
CREATE OR REPLACE FUNCTION public.rpc_notarized_job_set_precheck(
  p_job_id UUID,
  p_ok BOOLEAN,
  p_quality_score NUMERIC DEFAULT NULL,
  p_quality_flags TEXT[] DEFAULT NULL,
  p_doc_type_guess TEXT DEFAULT NULL,
  p_doc_type_confidence NUMERIC DEFAULT NULL,
  p_rejection_code TEXT DEFAULT NULL,
  p_rejection_reasons TEXT[] DEFAULT NULL,
  p_fix_tips TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_new_status TEXT;
BEGIN
  SELECT order_id INTO v_order_id FROM notarized_translation_jobs WHERE id = p_job_id;
  
  v_new_status := CASE WHEN p_ok THEN 'awaiting_payment' ELSE 'precheck_rejected' END;
  
  UPDATE notarized_translation_jobs
  SET
    quality_score = p_quality_score,
    quality_flags = p_quality_flags,
    doc_type_guess = p_doc_type_guess,
    doc_type_confidence = p_doc_type_confidence,
    rejection_code = CASE WHEN p_ok THEN NULL ELSE p_rejection_code END,
    rejection_reasons = CASE WHEN p_ok THEN NULL ELSE p_rejection_reasons END,
    fix_tips = CASE WHEN p_ok THEN NULL ELSE p_fix_tips END,
    status = v_new_status,
    updated_at = NOW()
  WHERE id = p_job_id;
  
  -- Log event
  INSERT INTO notarized_translation_events (job_id, order_id, event_type, new_status, actor_type, meta)
  VALUES (
    p_job_id, v_order_id,
    CASE WHEN p_ok THEN 'precheck_pass' ELSE 'precheck_reject' END,
    v_new_status, 'system',
    jsonb_build_object('quality_score', p_quality_score, 'rejection_code', p_rejection_code)
  );
  
  RETURN jsonb_build_object('ok', true, 'status', v_new_status);
END;
$$;

-- 5. Mark order as paid (stub)
CREATE OR REPLACE FUNCTION public.rpc_notarized_order_mark_paid(
  p_order_id UUID,
  p_payment_ref TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE notarized_translation_orders
  SET status = 'paid', payment_ref = p_payment_ref, updated_at = NOW()
  WHERE id = p_order_id;
  
  -- Update all jobs
  UPDATE notarized_translation_jobs
  SET status = 'paid', updated_at = NOW()
  WHERE order_id = p_order_id AND status = 'awaiting_payment';
  
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 6. Enqueue job for processing
CREATE OR REPLACE FUNCTION public.rpc_notarized_job_enqueue(
  p_job_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
BEGIN
  SELECT order_id INTO v_order_id FROM notarized_translation_jobs WHERE id = p_job_id;
  
  -- Insert into queue
  INSERT INTO notarized_translation_queue (job_id, priority, next_attempt_at)
  VALUES (p_job_id, 0, NOW())
  ON CONFLICT DO NOTHING;
  
  -- Update job status
  UPDATE notarized_translation_jobs
  SET status = 'processing_ocr', updated_at = NOW()
  WHERE id = p_job_id;
  
  -- Update order status
  UPDATE notarized_translation_orders
  SET status = 'processing', updated_at = NOW()
  WHERE id = v_order_id;
  
  -- Log
  INSERT INTO notarized_translation_events (job_id, order_id, event_type, new_status, actor_type)
  VALUES (p_job_id, v_order_id, 'enqueued', 'processing_ocr', 'system');
  
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 7. Set job status (for worker)
CREATE OR REPLACE FUNCTION public.rpc_notarized_job_set_status(
  p_job_id UUID,
  p_status TEXT,
  p_meta_json JSONB DEFAULT NULL,
  p_paths_json JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_old_status TEXT;
BEGIN
  SELECT order_id, status INTO v_order_id, v_old_status
  FROM notarized_translation_jobs WHERE id = p_job_id;
  
  UPDATE notarized_translation_jobs
  SET
    status = p_status,
    processing_meta = COALESCE(p_meta_json, processing_meta),
    draft_docx_path = COALESCE(p_paths_json->>'draft_docx_path', draft_docx_path),
    draft_pdf_path = COALESCE(p_paths_json->>'draft_pdf_path', draft_pdf_path),
    scan_pdf_path = COALESCE(p_paths_json->>'scan_pdf_path', scan_pdf_path),
    extracted_json_path = COALESCE(p_paths_json->>'extracted_json_path', extracted_json_path),
    error_message = CASE WHEN p_status = 'failed' THEN p_meta_json->>'error' ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_job_id;
  
  -- Update order if job complete
  IF p_status = 'draft_ready' THEN
    UPDATE notarized_translation_orders SET status = 'draft_ready', updated_at = NOW()
    WHERE id = v_order_id;
  END IF;
  
  -- Log
  INSERT INTO notarized_translation_events (job_id, order_id, event_type, old_status, new_status, actor_type, meta)
  VALUES (p_job_id, v_order_id, 'status_changed', v_old_status, p_status, 'worker', p_meta_json);
  
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 8. Purge expired orders
CREATE OR REPLACE FUNCTION public.rpc_notarized_purge_expired()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purged_count INTEGER := 0;
  v_order RECORD;
BEGIN
  FOR v_order IN
    SELECT id FROM notarized_translation_orders
    WHERE retention_expires_at < NOW() AND status != 'purged'
  LOOP
    -- Update jobs
    UPDATE notarized_translation_jobs SET status = 'purged' WHERE order_id = v_order.id;
    -- Update order
    UPDATE notarized_translation_orders SET status = 'purged' WHERE id = v_order.id;
    -- Log
    INSERT INTO notarized_translation_events (order_id, event_type, new_status, actor_type)
    VALUES (v_order.id, 'purged', 'purged', 'system');
    
    v_purged_count := v_purged_count + 1;
  END LOOP;
  
  RETURN jsonb_build_object('purged_count', v_purged_count);
END;
$$;

-- 9. Lock job from queue (for worker with SKIP LOCKED)
CREATE OR REPLACE FUNCTION public.rpc_notarized_queue_lock(
  p_worker_id TEXT,
  p_limit INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jobs JSONB := '[]'::JSONB;
  v_row RECORD;
BEGIN
  FOR v_row IN
    SELECT q.id as queue_id, q.job_id, j.doc_slot, j.original_path, j.template_id
    FROM notarized_translation_queue q
    JOIN notarized_translation_jobs j ON q.job_id = j.id
    WHERE q.locked_by IS NULL AND q.next_attempt_at <= NOW() AND q.attempts < q.max_attempts
    ORDER BY q.priority DESC, q.created_at
    LIMIT p_limit
    FOR UPDATE OF q SKIP LOCKED
  LOOP
    UPDATE notarized_translation_queue
    SET locked_by = p_worker_id, locked_at = NOW(), attempts = attempts + 1
    WHERE id = v_row.queue_id;
    
    v_jobs := v_jobs || jsonb_build_object(
      'queue_id', v_row.queue_id,
      'job_id', v_row.job_id,
      'doc_slot', v_row.doc_slot,
      'original_path', v_row.original_path,
      'template_id', v_row.template_id
    );
  END LOOP;
  
  RETURN jsonb_build_object('jobs', v_jobs);
END;
$$;

-- 10. Release queue lock
CREATE OR REPLACE FUNCTION public.rpc_notarized_queue_release(
  p_queue_id UUID,
  p_success BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_success THEN
    DELETE FROM notarized_translation_queue WHERE id = p_queue_id;
  ELSE
    UPDATE notarized_translation_queue
    SET locked_by = NULL, locked_at = NULL, next_attempt_at = NOW() + INTERVAL '5 minutes'
    WHERE id = p_queue_id;
  END IF;
  
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Revoke public access, grant to service_role only for queue operations
REVOKE EXECUTE ON FUNCTION public.rpc_notarized_queue_lock FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_notarized_queue_release FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_notarized_job_set_status FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_notarized_job_set_precheck FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_notarized_purge_expired FROM PUBLIC;