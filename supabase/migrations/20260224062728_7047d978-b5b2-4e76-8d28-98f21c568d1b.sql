CREATE TEMP TABLE _orphan_unis AS
SELECT u.id FROM universities u
WHERE (u.name_en IS NULL OR u.name_en = '') 
  AND (u.website IS NULL OR u.website = '')
  AND (u.slug IS NULL OR u.slug = '')
  AND (u.name_ar IS NULL OR u.name_ar = '')
  AND (u.uniranks_slug IS NULL OR u.uniranks_slug = '')
  AND NOT EXISTS (SELECT 1 FROM programs WHERE programs.university_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM application_items WHERE application_items.university_id = u.id);

-- Clean ALL FK references (direct + indirect)
DELETE FROM program_draft WHERE university_id IN (SELECT id FROM _orphan_unis);
DELETE FROM program_urls WHERE university_id IN (SELECT id FROM _orphan_unis);
DELETE FROM program_urls WHERE raw_page_id IN (
  SELECT rp.id FROM raw_pages rp WHERE rp.university_id IN (SELECT id FROM _orphan_unis)
);
DELETE FROM raw_pages WHERE university_id IN (SELECT id FROM _orphan_unis);
DELETE FROM university_enrichment_draft WHERE university_id IN (SELECT id FROM _orphan_unis);
DELETE FROM university_field_provenance WHERE university_id IN (SELECT id FROM _orphan_unis);
DELETE FROM university_external_ids WHERE university_id IN (SELECT id FROM _orphan_unis);
DELETE FROM uniranks_university_catalog WHERE matched_university_id IN (SELECT id FROM _orphan_unis);
DELETE FROM admissions_consensus WHERE university_id IN (SELECT id FROM _orphan_unis);
DELETE FROM admissions_observations WHERE university_id IN (SELECT id FROM _orphan_unis);
DELETE FROM crawl_batch_universities WHERE university_id IN (SELECT id FROM _orphan_unis);
DELETE FROM university_media WHERE university_id IN (SELECT id FROM _orphan_unis);
DELETE FROM university_housing WHERE university_id IN (SELECT id FROM _orphan_unis);
DELETE FROM price_observations WHERE university_id IN (SELECT id FROM _orphan_unis);
DELETE FROM tuition_consensus WHERE university_id IN (SELECT id FROM _orphan_unis);

DELETE FROM universities WHERE id IN (SELECT id FROM _orphan_unis);
DROP TABLE _orphan_unis;