-- Enable RLS on feature_flags (if not already enabled)
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies for feature_flags
DROP POLICY IF EXISTS admin_flags_select ON feature_flags;
DROP POLICY IF EXISTS admin_flags_upsert ON feature_flags;
DROP POLICY IF EXISTS admin_flags_update ON feature_flags;
DROP POLICY IF EXISTS ff_public_read ON feature_flags;

CREATE POLICY admin_flags_select ON feature_flags FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY admin_flags_upsert ON feature_flags FOR INSERT WITH CHECK (is_admin(auth.uid()));
CREATE POLICY admin_flags_update ON feature_flags FOR UPDATE USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Enable RLS on settings
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_settings_select ON settings;
DROP POLICY IF EXISTS admin_settings_upsert ON settings;
DROP POLICY IF EXISTS admin_settings_update ON settings;
DROP POLICY IF EXISTS settings_admin_write ON settings;
DROP POLICY IF EXISTS settings_select_admin ON settings;

CREATE POLICY admin_settings_select ON settings FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY admin_settings_upsert ON settings FOR INSERT WITH CHECK (is_admin(auth.uid()));
CREATE POLICY admin_settings_update ON settings FOR UPDATE USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Enable RLS on integration_outbox
ALTER TABLE integration_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_outbox_select ON integration_outbox;
CREATE POLICY admin_outbox_select ON integration_outbox FOR SELECT USING (is_admin(auth.uid()));

-- Enable RLS on ingestion tables
ALTER TABLE ingestion_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_ingestion_all ON ingestion_sources;
DROP POLICY IF EXISTS admin_ingestion_all2 ON ingestion_jobs;
DROP POLICY IF EXISTS admin_ingestion_results_select ON ingestion_results;
DROP POLICY IF EXISTS admin_ingestion_results_write ON ingestion_results;
DROP POLICY IF EXISTS admin_ingestion_results_update ON ingestion_results;
DROP POLICY IF EXISTS admin_ingestion_results_delete ON ingestion_results;

CREATE POLICY admin_ingestion_all ON ingestion_sources FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY admin_ingestion_all2 ON ingestion_jobs FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY admin_ingestion_results_select ON ingestion_results FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY admin_ingestion_results_write ON ingestion_results FOR INSERT WITH CHECK (is_admin(auth.uid()));
CREATE POLICY admin_ingestion_results_update ON ingestion_results FOR UPDATE USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY admin_ingestion_results_delete ON ingestion_results FOR DELETE USING (is_admin(auth.uid()));

-- Audit log table
CREATE TABLE IF NOT EXISTS admin_audit (
  id bigserial PRIMARY KEY,
  at timestamptz DEFAULT now(),
  admin_id uuid,
  action text,
  table_name text,
  row_key text,
  diff jsonb
);

-- Audit function for feature_flags
CREATE OR REPLACE FUNCTION audit_feature_flags()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO admin_audit(admin_id, action, table_name, row_key, diff)
  VALUES (auth.uid(), TG_OP, 'feature_flags', NEW.key, to_jsonb(NEW));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_audit_feature_flags ON feature_flags;
CREATE TRIGGER trg_audit_feature_flags
AFTER INSERT OR UPDATE ON feature_flags
FOR EACH ROW EXECUTE FUNCTION audit_feature_flags();