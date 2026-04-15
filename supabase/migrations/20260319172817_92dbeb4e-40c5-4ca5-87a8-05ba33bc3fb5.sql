
UPDATE official_site_crawl_jobs 
SET status = 'crawling', updated_at = now()
WHERE id = 'd1a2b3c4-0002-4000-8000-000000000099';
