CREATE OR REPLACE FUNCTION public.rpc_d4_progress_website()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'completed', COUNT(*) FILTER (WHERE website IS NOT NULL),
    'remaining', COUNT(*) FILTER (WHERE website IS NULL),
    'total', COUNT(*)
  )
  FROM universities
  WHERE uniranks_slug IS NOT NULL;
$$;
