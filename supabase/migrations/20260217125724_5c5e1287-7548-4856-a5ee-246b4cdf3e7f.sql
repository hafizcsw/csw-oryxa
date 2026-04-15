-- Fix: Remove updated_at reference (universities table doesn't have it)
CREATE OR REPLACE FUNCTION rpc_uniranks_backfill_country_for_matched(
  p_batch_limit int DEFAULT 5000,
  p_dry_run boolean DEFAULT false
)
RETURNS TABLE(updated_count int, still_missing int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int := 0;
BEGIN
  CREATE TEMP TABLE _backfill_candidates ON COMMIT DROP AS
  SELECT
    u.id AS university_id,
    lower(trim(uuc.country)) AS country_norm
  FROM uniranks_university_catalog uuc
  JOIN universities u ON u.id = uuc.matched_university_id
  WHERE uuc.match_status = 'matched'
    AND u.country_id IS NULL
    AND uuc.country IS NOT NULL
  LIMIT p_batch_limit;

  CREATE TEMP TABLE _backfill_resolved ON COMMIT DROP AS
  SELECT
    c.university_id,
    coalesce(ca.country_id, ct.id) AS country_id
  FROM _backfill_candidates c
  LEFT JOIN country_aliases ca ON ca.alias_normalized = c.country_norm
  LEFT JOIN countries ct ON lower(trim(ct.name_en)) = c.country_norm
  WHERE coalesce(ca.country_id, ct.id) IS NOT NULL;

  SELECT count(*) INTO v_updated FROM _backfill_resolved;

  IF NOT p_dry_run THEN
    UPDATE universities u
    SET country_id = r.country_id
    FROM _backfill_resolved r
    WHERE u.id = r.university_id
      AND u.country_id IS NULL;
  END IF;

  RETURN QUERY
  SELECT
    v_updated AS updated_count,
    (
      SELECT count(*)::int
      FROM uniranks_university_catalog uuc
      JOIN universities u ON u.id = uuc.matched_university_id
      WHERE uuc.match_status = 'matched'
        AND u.country_id IS NULL
    ) AS still_missing;
END $$;
