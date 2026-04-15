-- ══════════════════════════════════════════════════════════════════════════
-- Phase 1 Safety Repair — Production Cleanup Queries
-- Run MANUALLY after code freeze is deployed.
-- ══════════════════════════════════════════════════════════════════════════

-- ─── Q1: Audit Door5 programs in production (bypass count) ───
SELECT 
  COUNT(*) as total_door5_in_programs,
  COUNT(*) FILTER (WHERE publish_status = 'published') as published,
  COUNT(*) FILTER (WHERE publish_status = 'draft') as draft
FROM programs 
WHERE fingerprint LIKE 'sir_%';

-- ─── Q2: Door5 drafts status/tier breakdown ───
SELECT approval_tier, status, review_status, COUNT(*)
FROM program_draft
WHERE schema_version = 'door5-programs-v1'
GROUP BY 1,2,3
ORDER BY 4 DESC;

-- ─── Q3: Misclassified medical programs as bachelor ───
SELECT p.id, p.title, d.slug as degree_slug, p.publish_status, p.fingerprint
FROM programs p
LEFT JOIN degrees d ON d.id = p.degree_id
WHERE d.slug = 'bachelor'
AND (p.title ~* '\m(surgery|surgical|neurosurg|cardiosurg|orthop|residency|fellowship|clinical.specializ|specialty|speciality|ordinatura|internat|anesthes|radiology|oncology|obstetric|gynecol|patholog|dermatolog|ophthalmol|otolaryngol|urolog|psychiatr)\M')
ORDER BY p.title;

-- ─── Q4: Fix misclassified medical programs → unpublish + flag ───
-- STEP 1: Unpublish misclassified medical programs
UPDATE programs 
SET publish_status = 'draft', published = false
WHERE degree_id = (SELECT id FROM degrees WHERE slug = 'bachelor')
AND title ~* '\m(surgery|surgical|neurosurg|cardiosurg|orthop|residency|fellowship|clinical.specializ|specialty|speciality|ordinatura|internat|anesthes|radiology|oncology|obstetric|gynecol|patholog|dermatolog|ophthalmol|otolaryngol|urolog|psychiatr)\M'
AND publish_status = 'published';

-- STEP 2: Reassign degree to 'other' for review
UPDATE programs 
SET degree_id = (SELECT id FROM degrees WHERE slug = 'other')
WHERE degree_id = (SELECT id FROM degrees WHERE slug = 'bachelor')
AND title ~* '\m(surgery|surgical|neurosurg|cardiosurg|orthop|residency|fellowship|clinical.specializ|specialty|speciality|ordinatura|internat|anesthes|radiology|oncology|obstetric|gynecol|patholog|dermatolog|ophthalmol|otolaryngol|urolog|psychiatr)\M';

-- ─── Q5: Universities with potentially bad websites from Door5 ───
SELECT u.id, u.name, u.website, ufp.source_url, ufp.confidence
FROM universities u
JOIN university_field_provenance ufp ON ufp.university_id = u.id AND ufp.field_name = 'website'
WHERE ufp.source_url LIKE '%studyinrussia%'
ORDER BY ufp.confidence ASC
LIMIT 50;

-- ─── Q6: Verify freeze — count direct university writes from Door5 after deploy ───
SELECT event_type, COUNT(*), MAX(created_at)
FROM pipeline_health_events
WHERE pipeline = 'door5' 
AND event_type = 'safety_freeze'
GROUP BY 1;

-- ─── Q7: Verify admin-publish-qs-drafts freeze ───
-- After deploy, run dry_run=true to confirm no unverified drafts pass:
-- POST admin-publish-qs-drafts { "dry_run": true, "limit": 100 }
-- Expected: qs_filtered should be 0 unless drafts have approval_tier='auto' AND status='verified'
