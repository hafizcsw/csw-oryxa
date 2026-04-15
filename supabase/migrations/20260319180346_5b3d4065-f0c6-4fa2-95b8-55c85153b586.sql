-- Reset Liverpool crawl row for admissions proof run
UPDATE official_site_crawl_rows 
SET crawl_status = 'queued', 
    job_id = '17ace4cd-f4b0-45c5-801c-7ce695c63384',
    locked_at = NULL,
    error_message = NULL,
    updated_at = now()
WHERE id = 'd1a2b3c4-0004-4000-8000-000000000099'