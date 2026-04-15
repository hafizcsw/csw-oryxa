-- Remove foreign key constraint that's blocking inserts
ALTER TABLE harvest_review_queue 
DROP CONSTRAINT IF EXISTS harvest_review_queue_ingestion_id_fkey;

-- Make ingestion_id nullable since it may not exist in ingestion_results
ALTER TABLE harvest_review_queue 
ALTER COLUMN ingestion_id DROP NOT NULL;