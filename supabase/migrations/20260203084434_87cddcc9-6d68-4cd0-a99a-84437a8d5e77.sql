-- CLEANUP: Drop all versions of functions that have parameter conflicts
DROP FUNCTION IF EXISTS public.rpc_notarized_presign_upload(uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.rpc_notarized_upload_complete(uuid, text, jsonb);

-- Recreate presign with NO defaults
CREATE FUNCTION public.rpc_notarized_presign_upload(
  p_order_id UUID,
  p_job_id UUID,
  p_ext TEXT,
  p_content_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_order RECORD;
  v_job RECORD;
  v_object_path TEXT;
  v_safe_ext TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  SELECT * INTO v_order FROM notarized_translation_orders 
  WHERE id = p_order_id AND customer_id = v_user_id;
  
  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Order not found or not yours';
  END IF;
  
  SELECT * INTO v_job FROM notarized_translation_jobs 
  WHERE id = p_job_id AND order_id = p_order_id;
  
  IF v_job IS NULL THEN
    RAISE EXCEPTION 'Job not found or does not belong to order';
  END IF;
  
  IF COALESCE(v_job.page_count_locked, false) THEN
    RAISE EXCEPTION 'Cannot upload: quote already accepted for this job';
  END IF;
  
  v_safe_ext := LOWER(REGEXP_REPLACE(p_ext, '[^a-zA-Z0-9]', '', 'g'));
  IF v_safe_ext NOT IN ('pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic') THEN
    v_safe_ext := 'bin';
  END IF;
  
  v_object_path := format('originals/%s/%s/%s/original.%s', 
    v_user_id, p_order_id, p_job_id, v_safe_ext);
  
  RETURN jsonb_build_object(
    'ok', true,
    'bucket', 'notarized_originals',
    'object_path', v_object_path,
    'user_id', v_user_id,
    'content_type', COALESCE(p_content_type, 'application/octet-stream')
  );
END;
$$;

-- Recreate upload complete with NO defaults
CREATE FUNCTION public.rpc_notarized_upload_complete(
  p_job_id UUID,
  p_original_path TEXT,
  p_original_meta JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_job RECORD;
  v_order RECORD;
  v_expected_prefix TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  SELECT * INTO v_job FROM notarized_translation_jobs WHERE id = p_job_id;
  IF v_job IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;
  
  SELECT * INTO v_order FROM notarized_translation_orders 
  WHERE id = v_job.order_id AND customer_id = v_user_id;
  
  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Order not found or not yours';
  END IF;
  
  IF COALESCE(v_job.page_count_locked, false) THEN
    RAISE EXCEPTION 'Cannot modify upload: quote already accepted';
  END IF;
  
  v_expected_prefix := format('originals/%s/%s/%s/', v_user_id, v_order.id, p_job_id);
  
  IF NOT p_original_path LIKE v_expected_prefix || '%' THEN
    RAISE EXCEPTION 'Invalid upload path: path traversal attempt detected';
  END IF;
  
  UPDATE notarized_translation_jobs
  SET 
    original_path = p_original_path,
    original_meta = COALESCE(p_original_meta, '{}'::jsonb),
    status = 'awaiting_precheck',
    updated_at = now()
  WHERE id = p_job_id;
  
  RETURN jsonb_build_object(
    'ok', true,
    'job_id', p_job_id,
    'status', 'awaiting_precheck'
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.rpc_notarized_presign_upload TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_notarized_upload_complete TO authenticated;