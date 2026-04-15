-- Sprint C-1: Queue Redesign with Multi-Stage Support
-- This migration converts the queue from single-row to multi-row per stage model

-- Step 1: Drop the old UNIQUE constraint on job_id
ALTER TABLE public.notarized_translation_queue 
DROP CONSTRAINT IF EXISTS notarized_translation_queue_job_id_unique;

-- Step 2: Add stage column
ALTER TABLE public.notarized_translation_queue 
ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'ocr';

-- Step 3: Add status column for queue item state
ALTER TABLE public.notarized_translation_queue 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'queued';

-- Step 4: Add error tracking
ALTER TABLE public.notarized_translation_queue 
ADD COLUMN IF NOT EXISTS last_error TEXT;

-- Step 5: Add completed_at for analytics
ALTER TABLE public.notarized_translation_queue 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Step 6: Create new UNIQUE constraint on (job_id, stage) for active items only
-- This allows retries (different attempts) while preventing duplicate active items
CREATE UNIQUE INDEX IF NOT EXISTS idx_queue_job_stage_active 
ON public.notarized_translation_queue (job_id, stage) 
WHERE status IN ('queued', 'locked');

-- Step 7: Create index for worker polling (find next available work)
DROP INDEX IF EXISTS idx_notarized_queue_next;
CREATE INDEX idx_queue_worker_poll 
ON public.notarized_translation_queue (next_attempt_at, priority DESC) 
WHERE status = 'queued' AND locked_by IS NULL;

-- Step 8: Add lock TTL constant (10 minutes default)
ALTER TABLE public.notarized_translation_queue 
ADD COLUMN IF NOT EXISTS lock_ttl_seconds INTEGER DEFAULT 600;

-- Step 9: Update rpc_notarized_job_enqueue to use stage parameter
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

-- Step 10: Create rpc_notarized_queue_lock with TTL support
CREATE OR REPLACE FUNCTION public.rpc_notarized_queue_lock(
  p_worker_id TEXT,
  p_limit INTEGER DEFAULT 5,
  p_stage TEXT DEFAULT NULL
)
RETURNS TABLE (
  queue_id UUID,
  job_id UUID,
  stage TEXT,
  attempts INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- First, release any expired locks (TTL enforcement)
  UPDATE notarized_translation_queue q
  SET 
    locked_by = NULL,
    locked_at = NULL,
    status = 'queued',
    next_attempt_at = NOW() + INTERVAL '30 seconds'
  WHERE status = 'locked'
    AND locked_at < NOW() - (lock_ttl_seconds || ' seconds')::INTERVAL;
  
  -- Lock available items
  RETURN QUERY
  WITH locked AS (
    SELECT q.id, q.job_id, q.stage, q.attempts
    FROM notarized_translation_queue q
    WHERE q.status = 'queued'
      AND q.locked_by IS NULL
      AND q.next_attempt_at <= NOW()
      AND q.attempts < q.max_attempts
      AND (p_stage IS NULL OR q.stage = p_stage)
    ORDER BY q.priority DESC, q.next_attempt_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE notarized_translation_queue q
  SET 
    locked_by = p_worker_id,
    locked_at = NOW(),
    status = 'locked',
    attempts = q.attempts + 1
  FROM locked
  WHERE q.id = locked.id
  RETURNING q.id, q.job_id, q.stage, q.attempts;
END;
$$;

-- Step 11: Create rpc_notarized_queue_release for completion/failure
CREATE OR REPLACE FUNCTION public.rpc_notarized_queue_release(
  p_job_id UUID,
  p_success BOOLEAN,
  p_stage TEXT DEFAULT NULL,
  p_error TEXT DEFAULT NULL,
  p_next_stage TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queue_id UUID;
  v_current_stage TEXT;
BEGIN
  -- Find the queue item (use stage if provided)
  IF p_stage IS NOT NULL THEN
    SELECT id, stage INTO v_queue_id, v_current_stage
    FROM notarized_translation_queue
    WHERE job_id = p_job_id AND stage = p_stage AND status = 'locked';
  ELSE
    SELECT id, stage INTO v_queue_id, v_current_stage
    FROM notarized_translation_queue
    WHERE job_id = p_job_id AND status = 'locked'
    LIMIT 1;
  END IF;
  
  IF v_queue_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No locked queue item found');
  END IF;
  
  IF p_success THEN
    -- Mark as completed
    UPDATE notarized_translation_queue
    SET 
      status = 'completed',
      locked_by = NULL,
      completed_at = NOW()
    WHERE id = v_queue_id;
    
    -- If there's a next stage, enqueue it
    IF p_next_stage IS NOT NULL THEN
      PERFORM rpc_notarized_job_enqueue(p_job_id, p_next_stage);
    END IF;
  ELSE
    -- Handle failure
    UPDATE notarized_translation_queue
    SET 
      status = CASE 
        WHEN attempts >= max_attempts THEN 'failed'
        ELSE 'queued'
      END,
      locked_by = NULL,
      locked_at = NULL,
      last_error = p_error,
      next_attempt_at = CASE 
        WHEN attempts >= max_attempts THEN NULL
        ELSE NOW() + (attempts * INTERVAL '1 minute') -- Exponential backoff
      END
    WHERE id = v_queue_id;
  END IF;
  
  RETURN jsonb_build_object(
    'ok', true, 
    'success', p_success, 
    'stage', v_current_stage,
    'next_stage', p_next_stage
  );
END;
$$;

-- Step 12: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.rpc_notarized_job_enqueue(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_notarized_queue_lock(TEXT, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_notarized_queue_release(UUID, BOOLEAN, TEXT, TEXT, TEXT) TO service_role;