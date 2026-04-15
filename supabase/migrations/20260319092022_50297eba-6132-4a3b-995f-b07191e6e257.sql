
-- Reset TR pilot rows to queued for v3.1 rerun
UPDATE public.official_site_crawl_rows 
SET crawl_status = 'queued', reason_codes = NULL, error_message = NULL, 
    completeness_score = 0, completeness_by_section = '{}'::jsonb, 
    pages_scraped = 0, pages_mapped = 0, discovery_passes = '[]'::jsonb, 
    coverage_result = NULL, locked_at = NULL, locked_by = NULL, 
    updated_at = now() 
WHERE job_id = 'f052c9e9-1e4c-4b45-892a-f8218b5e9930';

-- Reset job status
UPDATE public.official_site_crawl_jobs 
SET status = 'crawling', phase = 'crawl', updated_at = now(), completed_at = NULL 
WHERE id = 'f052c9e9-1e4c-4b45-892a-f8218b5e9930';

-- Clear old observations
DELETE FROM public.official_site_observations 
WHERE job_id = 'f052c9e9-1e4c-4b45-892a-f8218b5e9930';

-- Clear old special queue entries for these universities
DELETE FROM public.official_site_special_queue 
WHERE university_id IN (
  SELECT university_id FROM public.official_site_crawl_rows 
  WHERE job_id = 'f052c9e9-1e4c-4b45-892a-f8218b5e9930'
);
