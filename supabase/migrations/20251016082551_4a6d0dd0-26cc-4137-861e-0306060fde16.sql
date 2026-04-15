-- Create integration_outbox table for CRM integration
CREATE TABLE IF NOT EXISTS integration_outbox (
  id bigserial PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  next_attempt_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbox_status_next ON integration_outbox(status, next_attempt_at);

-- Enable RLS
ALTER TABLE integration_outbox ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "Admins can manage outbox" ON integration_outbox
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Insert CRM settings
INSERT INTO feature_settings (key, value) VALUES
('crm_enabled', '{"enabled": false}'::jsonb),
('crm_webhook_url', '{"url": "https://crm.example.com/webhooks/applications"}'::jsonb),
('crm_auth_header', '{"header": "Authorization", "value": "Bearer xxxxx"}'::jsonb),
('crm_timeout_ms', '{"value": 5000}'::jsonb),
('crm_max_retries', '{"value": 5}'::jsonb)
ON CONFLICT (key) DO NOTHING;