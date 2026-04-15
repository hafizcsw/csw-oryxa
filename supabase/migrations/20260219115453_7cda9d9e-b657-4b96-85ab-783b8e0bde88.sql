
CREATE OR REPLACE FUNCTION public.rpc_door2_stage_counts()
RETURNS TABLE (stage TEXT, cnt BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT stage::text, COUNT(*) as cnt
  FROM public.uniranks_crawl_state
  GROUP BY stage;
$$;
