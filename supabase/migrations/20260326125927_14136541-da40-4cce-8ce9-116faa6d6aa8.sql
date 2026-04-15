-- Phase B2.1 Batch 1: Delete metric events (oldest 80,000)
DELETE FROM pipeline_health_events
WHERE id IN (
  SELECT id FROM pipeline_health_events
  WHERE event_type = 'metric'
  ORDER BY created_at ASC
  LIMIT 80000
);