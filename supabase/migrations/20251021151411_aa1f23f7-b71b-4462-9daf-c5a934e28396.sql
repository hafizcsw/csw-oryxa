-- إضافة فهارس للأداء
CREATE INDEX IF NOT EXISTS idx_ae_event_at ON analytics_events(event, at DESC);
CREATE INDEX IF NOT EXISTS idx_ae_tab_at ON analytics_events(tab, at DESC);
CREATE INDEX IF NOT EXISTS idx_outbox_target_status_next ON integration_outbox(target, status, next_attempt_at DESC);
CREATE INDEX IF NOT EXISTS idx_docs_status ON application_documents(status, created_at DESC);

-- دالة RPC موحدة لملخص لوحة التحكم
CREATE OR REPLACE FUNCTION admin_dashboard_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v jsonb := '{}';
BEGIN
  -- KPIs
  SELECT jsonb_build_object(
    'applications_new_24h', COALESCE((SELECT count(*) FROM analytics_events WHERE event='apply_submitted' AND at>=now()-interval '24 hours'),0),
    'p95_results_loaded_ms', COALESCE((SELECT percentile_disc(0.95) WITHIN GROUP (ORDER BY latency_ms) FROM analytics_events WHERE event='results_loaded' AND at>=now()-interval '24 hours'),0),
    'outbox_pending', COALESCE((SELECT count(*) FROM integration_outbox WHERE status='pending'),0),
    'docs_pending', COALESCE((SELECT count(*) FROM application_documents WHERE status='pending'),0),
    'contracts_draft', COALESCE((SELECT count(*) FROM contracts WHERE status='draft'),0)
  ) INTO v;

  -- Events recent
  v := v || jsonb_build_object('events_recent',
    (SELECT jsonb_agg(t) FROM (
      SELECT event, tab, route, at, latency_ms
      FROM analytics_events
      WHERE at>=now()-interval '2 hours'
      ORDER BY at DESC
      LIMIT 120
    ) t)
  );

  -- Queues
  v := v || jsonb_build_object('queues', jsonb_build_object(
    'outbox', (SELECT jsonb_agg(x) FROM (SELECT id, target, event_type, status, next_attempt_at FROM integration_outbox WHERE status IN ('pending','error') ORDER BY next_attempt_at ASC LIMIT 50) x),
    'docs', (SELECT jsonb_agg(x) FROM (SELECT id, application_id, doc_type, created_at FROM application_documents WHERE status='pending' ORDER BY created_at ASC LIMIT 50) x),
    'trans', (SELECT jsonb_agg(x) FROM (SELECT id, doc_kind, status, created_at FROM translation_requests WHERE status IN ('pending','processing') ORDER BY created_at ASC LIMIT 50) x)
  ));

  RETURN v;
END;
$$;