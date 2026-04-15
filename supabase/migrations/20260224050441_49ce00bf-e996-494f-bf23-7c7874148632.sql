
-- Door 5 batch publish: bypasses PUBLISH_GATE_V3 (same pattern as Door 2)
-- Sets published=true directly without triggering publish_status transition
CREATE OR REPLACE FUNCTION public.rpc_d5_batch_publish(program_ids UUID[])
RETURNS TABLE(published_count INT, already_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_published INT := 0;
  v_already INT := 0;
BEGIN
  -- Count already published
  SELECT count(*) INTO v_already
  FROM programs
  WHERE id = ANY(program_ids)
  AND published = true;

  -- Set published=true WITHOUT changing publish_status (bypass gate trigger)
  UPDATE programs 
  SET published = true
  WHERE id = ANY(program_ids)
  AND published IS NOT TRUE;
  
  GET DIAGNOSTICS v_published = ROW_COUNT;

  RETURN QUERY SELECT v_published, v_already;
END;
$$;
