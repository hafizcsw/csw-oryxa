-- Patch 16.1: Drop and recreate admin_dashboard_summary with new KPIs

DROP FUNCTION IF EXISTS admin_dashboard_summary();

CREATE OR REPLACE FUNCTION admin_dashboard_summary()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'applications_new_24h', (
      SELECT count(*) FROM applications 
      WHERE created_at > now() - interval '24 hours'
    ),
    'p95_results_loaded_ms', (
      SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)
      FROM analytics_events
      WHERE event = 'results_loaded'
        AND at > now() - interval '7 days'
    ),
    'outbox_pending', (
      SELECT count(*) FROM integration_outbox WHERE status = 'pending'
    ),
    'docs_pending', (
      SELECT count(*) FROM application_documents WHERE status = 'uploaded'
    ),
    'contracts_draft', (
      SELECT count(*) FROM contracts WHERE status = 'draft'
    ),
    'slides_active', (
      SELECT count(*) FROM slider_universities WHERE enabled = true
    ),
    'slider_last_update', (
      SELECT max(updated_at)::text FROM slider_universities
    ),
    'bot_events_24h', (
      SELECT count(*) FROM events 
      WHERE name IN ('ingestion_run', 'harvest_start')
        AND created_at > now() - interval '24 hours'
    ),
    'price_observations_24h', (
      SELECT count(*) FROM price_observations 
      WHERE observed_at > now() - interval '24 hours'
    ),
    'tuition_consensus_stale_count', (
      SELECT count(*) FROM tuition_consensus WHERE is_stale = true
    ),
    'scholarships_draft', (
      SELECT count(*) FROM scholarships WHERE status = 'draft'
    ),
    'scholarships_published', (
      SELECT count(*) FROM scholarships WHERE status = 'published'
    ),
    'events_recent', (
      SELECT json_agg(
        json_build_object(
          'id', id,
          'name', name,
          'created_at', created_at,
          'properties', properties
        )
      )
      FROM (
        SELECT id, name, created_at, properties
        FROM events
        ORDER BY created_at DESC
        LIMIT 10
      ) sub
    ),
    'queues', json_build_object(
      'outbox', (
        SELECT json_agg(
          json_build_object(
            'id', id,
            'event_type', event_type,
            'status', status,
            'attempts', attempts
          )
        )
        FROM (
          SELECT id, event_type, status, attempts
          FROM integration_outbox
          WHERE status = 'pending'
          ORDER BY created_at
          LIMIT 5
        ) sub
      ),
      'docs', (
        SELECT json_agg(
          json_build_object(
            'id', id,
            'doc_type', doc_type,
            'status', status
          )
        )
        FROM (
          SELECT id, doc_type, status
          FROM application_documents
          WHERE status = 'uploaded'
          ORDER BY created_at
          LIMIT 5
        ) sub
      ),
      'trans', (
        SELECT json_agg(
          json_build_object(
            'id', id,
            'status', status
          )
        )
        FROM (
          SELECT id, 'pending' as status
          FROM translation_requests
          WHERE status = 'pending'
          ORDER BY created_at
          LIMIT 5
        ) sub
      )
    )
  ) INTO result;
  
  RETURN result;
END;
$$;