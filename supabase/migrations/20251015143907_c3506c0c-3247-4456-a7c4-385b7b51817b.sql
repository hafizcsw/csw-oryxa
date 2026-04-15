-- LAV #13: Production Hardening
-- Add feature flags to settings table

DO $$
BEGIN
  -- Update flags to include new feature toggles
  UPDATE settings
  SET flags = flags || jsonb_build_object(
    'RECOMMENDATIONS_ENABLED', true,
    'SCHOLARSHIPS_ENABLED', true,
    'WHATSAPP_ENABLED', true,
    'RATE_LIMITING_ENABLED', true,
    'CACHE_ENABLED', true
  )
  WHERE id = true;
  
  -- If no settings row exists, create one
  IF NOT FOUND THEN
    INSERT INTO settings(id, flags)
    VALUES (true, jsonb_build_object(
      'RECOMMENDATIONS_ENABLED', true,
      'SCHOLARSHIPS_ENABLED', true,
      'WHATSAPP_ENABLED', true,
      'RATE_LIMITING_ENABLED', true,
      'CACHE_ENABLED', true,
      'VOICE_ENABLED', false,
      'BOT_ENABLED', false,
      'CRM_INTEGRATION_ENABLED', false,
      'PAYMENTS_ENABLED', false,
      'ANALYTICS_ENABLED', true
    ))
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Add index for faster event queries
CREATE INDEX IF NOT EXISTS idx_events_name_created ON events(name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_visitor_created ON events(visitor_id, created_at DESC);

-- Add index for integration monitoring
CREATE INDEX IF NOT EXISTS idx_integration_events_status_created ON integration_events(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_status_created ON notifications(status, created_at DESC);

-- Add function to get system health stats
CREATE OR REPLACE FUNCTION get_system_health()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'integration_errors', (
      SELECT count(*)
      FROM integration_events
      WHERE status = 'error'
        AND created_at > now() - interval '10 minutes'
    ),
    'queued_events', (
      SELECT count(*)
      FROM integration_events
      WHERE status = 'queued'
    ),
    'queued_notifications', (
      SELECT count(*)
      FROM notifications
      WHERE status = 'queued'
    ),
    'last_cron_run', (
      SELECT max(created_at)
      FROM events
      WHERE name = 'cron.popularity_refreshed'
    ),
    'active_users_24h', (
      SELECT count(DISTINCT visitor_id)
      FROM events
      WHERE created_at > now() - interval '24 hours'
    )
  );
$$;

-- Grant access to health function
GRANT EXECUTE ON FUNCTION get_system_health() TO authenticated, anon;
