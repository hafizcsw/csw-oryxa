
-- 1) Quarantine RPC: set is_active=false for universities with country_id IS NULL
CREATE OR REPLACE FUNCTION rpc_quarantine_universities_without_country()
RETURNS TABLE(quarantined_count int, remaining_active int, sample_ids text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_sample text[];
BEGIN
  -- Collect sample before update
  SELECT array_agg(id::text) INTO v_sample
  FROM (
    SELECT id FROM universities
    WHERE country_id IS NULL AND is_active = true
    ORDER BY created_at DESC
    LIMIT 5
  ) s;

  -- Execute quarantine
  UPDATE universities
  SET is_active = false
  WHERE country_id IS NULL AND is_active = true;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN QUERY
  SELECT
    v_count AS quarantined_count,
    (SELECT count(*)::int FROM universities WHERE is_active = true) AS remaining_active,
    v_sample AS sample_ids;
END $$;

-- 2) Auto-reactivation trigger: when country_id is filled on a quarantined university
CREATE OR REPLACE FUNCTION trg_auto_reactivate_university()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only reactivate if country_id was NULL and is now filled,
  -- AND the university has a uniranks_profile_url (legitimate record)
  IF OLD.country_id IS NULL
     AND NEW.country_id IS NOT NULL
     AND NEW.is_active = false
     AND NEW.uniranks_profile_url IS NOT NULL
  THEN
    NEW.is_active := true;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_universities_auto_reactivate ON universities;
CREATE TRIGGER trg_universities_auto_reactivate
  BEFORE UPDATE ON universities
  FOR EACH ROW
  EXECUTE FUNCTION trg_auto_reactivate_university();
