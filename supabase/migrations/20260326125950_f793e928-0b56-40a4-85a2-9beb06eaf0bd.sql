-- Phase B2.1 Batch 3 (final): Delete all remaining metric events
DELETE FROM pipeline_health_events
WHERE event_type = 'metric';