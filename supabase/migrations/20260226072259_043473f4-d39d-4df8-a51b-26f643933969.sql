
-- RPC to reset phases_done for re-crawl
CREATE OR REPLACE FUNCTION public.rpc_d5_reset_phases()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_count integer;
BEGIN
  UPDATE university_external_ids
  SET phases_done = '{}'::text[],
      last_seen_at = NULL
  WHERE source_name = 'studyinrussia'
    AND university_id IS NOT NULL;
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  RETURN jsonb_build_object('reset_count', affected_count);
END;
$$;
