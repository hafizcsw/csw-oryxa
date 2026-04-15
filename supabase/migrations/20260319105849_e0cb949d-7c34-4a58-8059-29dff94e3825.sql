UPDATE public.official_site_crawl_rows
SET crawl_status = 'special', completeness_score = 0, updated_at = now()
WHERE id = 'dce649b5-d05d-43ff-b94d-999a4fa61508';

DELETE FROM public.official_site_observations
WHERE row_id = 'dce649b5-d05d-43ff-b94d-999a4fa61508'
  AND parser_version = 'osc-hard-v2.1';