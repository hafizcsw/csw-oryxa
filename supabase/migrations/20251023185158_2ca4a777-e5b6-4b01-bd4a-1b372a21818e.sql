-- Patch 20: Launch Hardening + Safety Switches
-- Non-destructive: adds feature flags, rate limits, alerts

-- Feature flags table (if not exists)
CREATE TABLE IF NOT EXISTS public.system_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  config JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for system_flags
ALTER TABLE public.system_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage system flags"
  ON public.system_flags FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Insert default flags
INSERT INTO public.system_flags (key, enabled, config) VALUES
  ('harvest_enabled', true, '{"max_concurrency": 3, "allowed_countries": ["DE", "GB", "US", "CA", "AU", "NL", "ES", "RU"]}'::jsonb),
  ('crm_integration_enabled', true, '{}'::jsonb),
  ('whatsapp_enabled', true, '{}'::jsonb),
  ('payments_enabled', false, '{}'::jsonb),
  ('site_readonly', false, '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Rate limit tracking table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id BIGSERIAL PRIMARY KEY,
  domain TEXT NOT NULL,
  endpoint TEXT,
  last_request_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  requests_count INT NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_domain ON public.rate_limits(domain, window_start);

-- System alerts table
CREATE TABLE IF NOT EXISTS public.system_alerts (
  id BIGSERIAL PRIMARY KEY,
  level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error', 'critical')),
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  acknowledged BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_alerts_level ON public.system_alerts(level, created_at);

-- RLS for system_alerts
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view system alerts"
  ON public.system_alerts FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "System can insert alerts"
  ON public.system_alerts FOR INSERT
  WITH CHECK (true);

-- Function to check rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_domain TEXT,
  p_endpoint TEXT DEFAULT NULL,
  p_max_requests INT DEFAULT 60,
  p_window_seconds INT DEFAULT 60
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
  v_window_start TIMESTAMPTZ;
BEGIN
  v_window_start := now() - (p_window_seconds || ' seconds')::INTERVAL;
  
  -- Clean old entries
  DELETE FROM rate_limits 
  WHERE domain = p_domain 
    AND window_start < v_window_start;
  
  -- Count recent requests
  SELECT COUNT(*) INTO v_count
  FROM rate_limits
  WHERE domain = p_domain
    AND (p_endpoint IS NULL OR endpoint = p_endpoint)
    AND window_start >= v_window_start;
  
  -- If under limit, record request and allow
  IF v_count < p_max_requests THEN
    INSERT INTO rate_limits (domain, endpoint, window_start)
    VALUES (p_domain, p_endpoint, now());
    RETURN true;
  END IF;
  
  -- Rate limit exceeded
  RETURN false;
END;
$$;

-- Function to get system health
CREATE OR REPLACE FUNCTION get_system_health_v2()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'harvest', jsonb_build_object(
      'pending_jobs', (SELECT COUNT(*) FROM harvest_jobs WHERE status = 'pending'),
      'running_jobs', (SELECT COUNT(*) FROM harvest_jobs WHERE status = 'running'),
      'failed_jobs', (SELECT COUNT(*) FROM harvest_jobs WHERE status = 'error')
    ),
    'outbox', jsonb_build_object(
      'pending', (SELECT COUNT(*) FROM integration_outbox WHERE status = 'pending'),
      'errors', (SELECT COUNT(*) FROM integration_outbox WHERE status = 'error')
    ),
    'alerts', jsonb_build_object(
      'unacknowledged', (SELECT COUNT(*) FROM system_alerts WHERE NOT acknowledged),
      'critical', (SELECT COUNT(*) FROM system_alerts WHERE level = 'critical' AND NOT acknowledged)
    ),
    'flags', (SELECT jsonb_object_agg(key, enabled) FROM system_flags),
    'timestamp', now()
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;