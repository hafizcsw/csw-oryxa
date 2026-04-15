-- Enable RLS on settings table
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Admin-only read policy
DROP POLICY IF EXISTS settings_select_admin ON settings;
CREATE POLICY settings_select_admin ON settings
  FOR SELECT 
  USING (is_admin(auth.uid()));

-- Admin-only write policy  
DROP POLICY IF EXISTS settings_admin_write ON settings;
CREATE POLICY settings_admin_write ON settings
  FOR ALL 
  USING (is_admin(auth.uid())) 
  WITH CHECK (is_admin(auth.uid()));