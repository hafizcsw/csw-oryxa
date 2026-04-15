-- Create feature_settings table for key-value settings
CREATE TABLE IF NOT EXISTS feature_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE feature_settings ENABLE ROW LEVEL SECURITY;

-- Public can read (for get-settings endpoint)
CREATE POLICY feature_settings_public_read ON feature_settings
  FOR SELECT 
  USING (true);

-- Admin only write
CREATE POLICY feature_settings_admin_write ON feature_settings
  FOR ALL 
  USING (is_admin(auth.uid())) 
  WITH CHECK (is_admin(auth.uid()));

-- Insert initial feature flags
INSERT INTO feature_settings (key, value) VALUES
  ('voice_bot_enabled', '{"enabled": false}'::jsonb),
  ('compare_enabled', '{"enabled": true}'::jsonb),
  ('events_tab_enabled', '{"enabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;