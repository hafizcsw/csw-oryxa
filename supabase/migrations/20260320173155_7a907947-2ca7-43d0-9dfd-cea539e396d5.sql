INSERT INTO official_site_crawl_jobs (id, status, mode, max_pages_per_uni, source_policy, created_at)
VALUES ('cccccccc-dddd-eeee-ffff-111111111111', 'crawling', 'pilot10', 20, 'official_only', now());

INSERT INTO official_site_crawl_rows (job_id, university_id, university_name, website, crawl_status, created_at, updated_at)
VALUES ('cccccccc-dddd-eeee-ffff-111111111111', '487e16c6-9831-4fab-952f-8161978ad728', 'Peter the Great St.Petersburg Polytechnic University', 'https://english.spbstu.ru/', 'queued', now(), now());