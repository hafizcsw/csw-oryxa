-- Force publish remaining 494: drop constraint, update, clear conflicts differently
DROP INDEX IF EXISTS uq_universities_website_host;

-- For each unpublished row, if another uni has the same host, clear the OTHER uni's website
-- Then set this uni's website
WITH to_publish AS (
  SELECT DISTINCT ON (w.university_id) 
    w.university_id, 
    w.provider_homepage_url_raw AS url
  FROM website_enrichment_rows w
  JOIN universities u ON u.id = w.university_id
  WHERE w.job_id = '87b5eeb2-a1bd-48a7-9668-502d8f6eb7cd'
    AND w.provider_homepage_url_raw IS NOT NULL AND w.provider_homepage_url_raw != ''
    AND (u.website IS NULL OR u.website = '')
    AND u.is_active = true
  ORDER BY w.university_id
)
UPDATE universities u
SET website = tp.url
FROM to_publish tp
WHERE u.id = tp.university_id;

-- Now deduplicate: for each duplicate host, keep the one that was JUST set (has enrichment row)
-- and clear the other
WITH dupes AS (
  SELECT u.id, u.website_host,
    CASE WHEN EXISTS (
      SELECT 1 FROM website_enrichment_rows w 
      WHERE w.university_id = u.id 
        AND w.job_id = '87b5eeb2-a1bd-48a7-9668-502d8f6eb7cd'
        AND w.provider_homepage_url_raw IS NOT NULL
    ) THEN 0 ELSE 1 END AS priority,
    ROW_NUMBER() OVER (
      PARTITION BY u.website_host 
      ORDER BY 
        CASE WHEN EXISTS (
          SELECT 1 FROM website_enrichment_rows w 
          WHERE w.university_id = u.id 
            AND w.job_id = '87b5eeb2-a1bd-48a7-9668-502d8f6eb7cd'
            AND w.provider_homepage_url_raw IS NOT NULL
        ) THEN 0 ELSE 1 END,
        COALESCE(u.ranking, 999999), u.id
    ) AS rn
  FROM universities u
  WHERE u.website_host IS NOT NULL AND u.website_host != ''
)
UPDATE universities SET website = NULL WHERE id IN (SELECT id FROM dupes WHERE rn > 1);

CREATE UNIQUE INDEX uq_universities_website_host ON universities (website_host) WHERE website_host IS NOT NULL;