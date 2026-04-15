-- Fix ambiguous function call by dropping old signature
DROP FUNCTION IF EXISTS public.rpc_notarized_job_enqueue(UUID);

-- Recreate with default stage
CREATE OR REPLACE FUNCTION public.rpc_notarized_job_enqueue(
  p_job_id UUID,
  p_stage TEXT DEFAULT 'ocr'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_queue_id UUID;
BEGIN
  SELECT order_id INTO v_order_id FROM notarized_translation_jobs WHERE id = p_job_id;
  
  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'Job not found: %', p_job_id;
  END IF;
  
  -- Insert into queue with stage - ON CONFLICT handles idempotency
  INSERT INTO notarized_translation_queue (job_id, stage, priority, next_attempt_at, status)
  VALUES (p_job_id, p_stage, 0, NOW(), 'queued')
  ON CONFLICT (job_id, stage) WHERE status IN ('queued', 'locked') DO NOTHING
  RETURNING id INTO v_queue_id;
  
  -- If v_queue_id is NULL, it means row already exists (idempotent)
  IF v_queue_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'stage', p_stage);
  END IF;
  
  -- Update job status only for first stage
  IF p_stage = 'ocr' THEN
    UPDATE notarized_translation_jobs
    SET status = 'processing_ocr', updated_at = NOW()
    WHERE id = p_job_id;
    
    UPDATE notarized_translation_orders
    SET status = 'processing', updated_at = NOW()
    WHERE id = v_order_id;
  END IF;
  
  -- Log event
  INSERT INTO notarized_translation_events (job_id, order_id, event_type, new_status, actor_type, meta)
  VALUES (p_job_id, v_order_id, 'enqueued', 'processing_' || p_stage, 'system', 
          jsonb_build_object('stage', p_stage, 'queue_id', v_queue_id));
  
  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'queue_id', v_queue_id, 'stage', p_stage);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_notarized_job_enqueue(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_notarized_job_enqueue(UUID, TEXT) TO service_role;