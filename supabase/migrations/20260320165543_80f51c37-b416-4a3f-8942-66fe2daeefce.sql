INSERT INTO official_site_crawl_jobs (id, status, mode, max_pages_per_uni, source_policy, created_at)
VALUES ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001', 'crawling', 'pilot10', 10, 'official_only', now());

INSERT INTO official_site_crawl_rows (job_id, university_id, university_name, website, crawl_status, created_at, updated_at)
VALUES ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001', '43dc2157-fa77-4ae2-8e5d-25dd7897d7ec', 'Campbell University', 'https://www.campbell.edu', 'queued', now(), now());

INSERT INTO official_site_crawl_rows (job_id, university_id, university_name, website, crawl_status, created_at, updated_at)
VALUES ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001', 'f394837c-6981-4900-9531-77e87191b1af', 'University of Liverpool', 'https://www.liverpool.ac.uk', 'queued', now(), now());