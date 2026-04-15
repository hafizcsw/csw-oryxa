
-- Add composite index to speed up the NOT EXISTS check
CREATE INDEX IF NOT EXISTS idx_enrichment_draft_uni_field 
ON university_enrichment_draft(university_id, field_name);

-- Add index on universities for the common query pattern
CREATE INDEX IF NOT EXISTS idx_universities_website_null 
ON universities(uniranks_rank ASC NULLS LAST) 
WHERE website IS NULL AND uniranks_slug IS NOT NULL;
