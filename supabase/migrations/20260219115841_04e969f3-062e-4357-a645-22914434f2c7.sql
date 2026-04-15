
CREATE OR REPLACE FUNCTION public.rpc_door2_progress()
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT json_build_object(
    'total', (SELECT COUNT(*) FROM public.uniranks_crawl_state),
    'done', (SELECT COUNT(*) FROM public.uniranks_crawl_state WHERE stage = 'done'),
    'done_1h', (SELECT COUNT(*) FROM public.uniranks_crawl_state WHERE stage = 'done' AND updated_at > now() - interval '1 hour'),
    'done_15m', (SELECT COUNT(*) FROM public.uniranks_crawl_state WHERE stage = 'done' AND updated_at > now() - interval '15 minutes'),
    'active_stages', (
      SELECT json_agg(json_build_object('stage', stage, 'cnt', cnt))
      FROM (
        SELECT stage, COUNT(*) as cnt 
        FROM public.uniranks_crawl_state 
        WHERE stage LIKE '%_fetching'
        GROUP BY stage
      ) sub
    ),
    'first_done_at', (SELECT MIN(updated_at) FROM public.uniranks_crawl_state WHERE stage = 'done'),
    'last_activity_at', (SELECT MAX(updated_at) FROM public.uniranks_crawl_state WHERE stage LIKE '%_fetching')
  );
$$;
