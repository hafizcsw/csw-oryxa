-- Fix path format consistency: presign should include 'originals/' prefix
-- to match what upload_complete expects

-- Fix 1: Update presign to include 'originals/' prefix in path
CREATE OR REPLACE FUNCTION public.rpc_notarized_presign_upload(
  p_order_id uuid,
  p_job_id uuid,
  p_ext text,
  p_content_type text DEFAULT 'application/octet-stream'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_order record;
  v_job record;
  v_object_path text;
  v_bucket text := 'notarized_originals';
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_order
  FROM notarized_translation_orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.customer_id != v_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_order.status IN ('paid', 'processing', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot upload: order is % and locked', v_order.status;
  END IF;

  SELECT * INTO v_job
  FROM notarized_translation_jobs
  WHERE id = p_job_id AND order_id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found or does not belong to this order';
  END IF;

  -- FIXED: Include 'originals/' prefix to match upload_complete validation
  v_object_path := 'originals/' || v_user_id::text || '/' || p_order_id::text || '/' || p_job_id::text || '/original.' || p_ext;

  IF v_order.status = 'quoted' THEN
    UPDATE notarized_translation_orders
    SET status = 'draft', updated_at = now()
    WHERE id = p_order_id;
    
    UPDATE notarized_translation_jobs
    SET status = 'awaiting_upload',
        original_path = NULL,
        page_count = NULL,
        precheck_result = NULL,
        updated_at = now()
    WHERE id = p_job_id;
  END IF;

  RETURN jsonb_build_object(
    'bucket', v_bucket,
    'object_path', v_object_path
  );
END;
$$;