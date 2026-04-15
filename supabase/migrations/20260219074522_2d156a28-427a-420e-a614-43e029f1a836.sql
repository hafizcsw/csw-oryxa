
CREATE OR REPLACE FUNCTION public.rpc_pick_door2_candidates(
  p_max_units integer DEFAULT 20,
  p_now timestamptz DEFAULT now()
)
RETURNS TABLE(university_id text, uniranks_profile_url text, stage text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cs.university_id, cs.uniranks_profile_url, cs.stage
  FROM uniranks_crawl_state cs
  WHERE cs.stage IN ('profile_pending', 'programs_pending', 'details_pending')
    AND (cs.locked_until IS NULL OR cs.locked_until < p_now)
  ORDER BY
    CASE cs.stage
      WHEN 'profile_pending'  THEN 0
      WHEN 'programs_pending' THEN 1
      WHEN 'details_pending'  THEN 2
      ELSE 3
    END,
    cs.updated_at ASC
  LIMIT p_max_units;
$$;
