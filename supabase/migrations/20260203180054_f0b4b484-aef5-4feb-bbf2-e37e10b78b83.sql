-- =============================================
-- Fix: Allow file uploads before payment (even if quote accepted)
-- The current RPC blocks uploads once quote is accepted.
-- New logic: Block uploads ONLY if order is paid/processing/delivered
-- =============================================

-- First, drop existing function to avoid signature conflicts
DROP FUNCTION IF EXISTS rpc_notarized_presign_upload(uuid, uuid, text, text);

-- Recreate with relaxed logic
CREATE OR REPLACE FUNCTION rpc_notarized_presign_upload(
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
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get order and verify ownership
  SELECT * INTO v_order
  FROM notarized_orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.customer_id != v_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Block uploads ONLY if order is already paid/processing/delivered
  -- Allow uploads even if quote is accepted (but not paid yet)
  IF v_order.status IN ('paid', 'processing', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot upload: order is % and locked', v_order.status;
  END IF;

  -- Get job and verify it belongs to this order
  SELECT * INTO v_job
  FROM notarized_translation_jobs
  WHERE id = p_job_id AND order_id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found or does not belong to this order';
  END IF;

  -- Build object path: {user_id}/{order_id}/{job_id}/original.{ext}
  v_object_path := v_user_id::text || '/' || p_order_id::text || '/' || p_job_id::text || '/original.' || p_ext;

  -- If replacing a file after quote was accepted, invalidate the quote
  -- This forces a re-quote with potentially different page counts
  IF v_order.status = 'quoted' THEN
    UPDATE notarized_orders
    SET status = 'draft', updated_at = now()
    WHERE id = p_order_id;
    
    -- Reset job status to allow re-precheck
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