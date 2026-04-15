INSERT INTO official_site_crawl_jobs (id, status, mode, max_pages_per_uni, source_policy, created_at)
VALUES ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', 'crawling', 'pilot10', 10, 'official_only', now());

INSERT INTO official_site_crawl_rows (job_id, university_id, university_name, website, crawl_status, created_at, updated_at)
VALUES ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', '43dc2157-fa77-4ae2-8e5d-25dd7897d7ec', 'Campbell University', 'https://www.campbell.edu', 'queued', now(), now());