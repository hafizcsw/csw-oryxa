-- Publish the remaining 610 universities that have URLs but website is still NULL
-- First drop constraint temporarily
DROP INDEX IF EXISTS uq_universities_website_host;

-- Update
UPDATE universities u
SET website = sub.url
FROM (
  SELECT DISTINCT ON (w.university_id) w.university_id, w.provider_homepage_url_raw AS url
  FROM website_enrichment_rows w
  JOIN universities u2 ON u2.id = w.university_id
  WHERE w.job_id = '87b5eeb2-a1bd-48a7-9668-502d8f6eb7cd'
    AND w.provider_homepage_url_raw IS NOT NULL AND w.provider_homepage_url_raw != ''
    AND (u2.website IS NULL OR u2.website = '')
    AND u2.is_active = true
  ORDER BY w.university_id
) sub
WHERE u.id = sub.university_id;

-- Clean any new duplicates
WITH dupes AS (
  SELECT id, website_host,
    ROW_NUMBER() OVER (PARTITION BY website_host ORDER BY COALESCE(ranking, 999999), id) AS rn
  FROM universities
  WHERE website_host IS NOT NULL AND website_host != ''
)
UPDATE universities SET website = NULL WHERE id IN (SELECT id FROM dupes WHERE rn > 1);

-- Re-add constraint
CREATE UNIQUE INDEX uq_universities_website_host ON universities (website_host) WHERE website_host IS NOT NULL;