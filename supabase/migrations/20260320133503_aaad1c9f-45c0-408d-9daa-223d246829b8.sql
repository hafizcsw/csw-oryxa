-- Bulk update all remaining enrichment URLs
UPDATE universities u
SET website = w.provider_homepage_url_raw
FROM website_enrichment_rows w
WHERE w.job_id = '87b5eeb2-a1bd-48a7-9668-502d8f6eb7cd'
  AND w.enrichment_status = 'applied'
  AND w.provider_homepage_url_raw IS NOT NULL
  AND w.provider_homepage_url_raw != ''
  AND w.university_id = u.id
  AND (u.website IS NULL OR u.website = '');