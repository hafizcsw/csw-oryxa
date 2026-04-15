
-- 1) Batch seeding RPC: seeds universities with uniranks_profile_url into crawl_state
-- Idempotent: skips existing. Returns count seeded this call.
DROP FUNCTION IF EXISTS public.rpc_seed_door2_crawl_state(int);

CREATE OR REPLACE FUNCTION public.rpc_seed_door2_crawl_state(
  p_batch_size int DEFAULT 5000
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_seeded int;
  v_total_before int;
  v_total_after int;
  v_target int;
BEGIN
  SELECT COUNT(*) INTO v_total_before FROM uniranks_crawl_state;
  SELECT COUNT(*) INTO v_target FROM universities WHERE uniranks_profile_url IS NOT NULL;

  INSERT INTO uniranks_crawl_state (university_id, uniranks_profile_url, stage)
  SELECT u.id::text, u.uniranks_profile_url, 'profile_pending'
  FROM universities u
  WHERE u.uniranks_profile_url IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM uniranks_crawl_state cs WHERE cs.university_id = u.id::text
    )
  ORDER BY u.uniranks_rank ASC NULLS LAST, u.name_en ASC NULLS LAST
  LIMIT p_batch_size;

  GET DIAGNOSTICS v_seeded = ROW_COUNT;

  SELECT COUNT(*) INTO v_total_after FROM uniranks_crawl_state;

  RETURN jsonb_build_object(
    'seeded_this_call', v_seeded,
    'state_total_before', v_total_before,
    'state_total_after', v_total_after,
    'target_total', v_target,
    'remaining', v_target - v_total_after
  );
END;
$$;

-- 2) Update candidate picker to order by uniranks_rank instead of updated_at
DROP FUNCTION IF EXISTS public.rpc_pick_door2_candidates(int);

CREATE OR REPLACE FUNCTION public.rpc_pick_door2_candidates(
  p_limit int DEFAULT 20
)
RETURNS TABLE(university_id text, uniranks_profile_url text, stage text)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT cs.university_id, cs.uniranks_profile_url, cs.stage
  FROM uniranks_crawl_state cs
  JOIN universities u ON u.id::text = cs.university_id
  WHERE cs.stage IN ('profile_pending','programs_pending','details_pending')
    AND (cs.locked_until IS NULL OR cs.locked_until < now())
    AND cs.quarantine_reason IS NULL
  ORDER BY
    CASE cs.stage
      WHEN 'profile_pending' THEN 0
      WHEN 'programs_pending' THEN 1
      WHEN 'details_pending' THEN 2
    END ASC,
    u.uniranks_rank ASC NULLS LAST,
    u.name_en ASC NULLS LAST
  LIMIT p_limit;
END;
$$;

NOTIFY pgrst, 'reload schema';
