-- Clean duplicate website_hosts - keep the one with better ranking
WITH dupes AS (
  SELECT id, website_host,
    ROW_NUMBER() OVER (
      PARTITION BY website_host 
      ORDER BY COALESCE(ranking, 999999) ASC, id
    ) AS rn
  FROM universities
  WHERE website_host IS NOT NULL AND website_host != ''
)
UPDATE universities SET website = NULL
WHERE id IN (SELECT id FROM dupes WHERE rn > 1);

-- Re-add unique constraint
CREATE UNIQUE INDEX uq_universities_website_host 
ON universities (website_host) 
WHERE website_host IS NOT NULL;