-- Phase B1 Batch 1: Delete oldest 50,000 rows from ingest_errors (older than 7 days)
DELETE FROM ingest_errors
WHERE id IN (
  SELECT id FROM ingest_errors
  WHERE created_at < now() - interval '7 days'
  ORDER BY created_at ASC
  LIMIT 50000
);