-- Phase B1 Batch 3 (final): Delete remaining rows from ingest_errors older than 7 days
DELETE FROM ingest_errors
WHERE created_at < now() - interval '7 days';