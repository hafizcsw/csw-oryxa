-- ============================================================
-- Door 1 Fix: Country Backfill Infrastructure
-- ============================================================

-- 0) Add unique constraint on country_code for future safety
CREATE UNIQUE INDEX IF NOT EXISTS idx_countries_country_code_unique ON countries(country_code);

-- 1) Add missing countries/territories
INSERT INTO countries (name_en, name_ar, slug, country_code)
VALUES
  ('Bahamas',          'جزر الباهاما',        'bahamas',                    'BS'),
  ('Guam',             'غوام',                'guam',                       'GU'),
  ('Faroe Islands',    'جزر فارو',            'faroe-islands',              'FO'),
  ('French Polynesia', 'بولينيزيا الفرنسية',  'french-polynesia',           'PF'),
  ('US Virgin Islands','جزر العذراء الأمريكية','us-virgin-islands',          'VI'),
  ('Anguilla',         'أنغويلا',             'anguilla',                   'AI'),
  ('Greenland',        'غرينلاند',            'greenland',                  'GL'),
  ('Cayman Islands',   'جزر كايمان',          'cayman-islands',             'KY')
ON CONFLICT (slug) DO NOTHING;

-- 2) Add aliases for names that don't match name_en directly
INSERT INTO country_aliases (country_id, alias_normalized, source)
VALUES
  ((SELECT id FROM countries WHERE country_code='DO'), 'dominican', 'uniranks_backfill'),
  ((SELECT id FROM countries WHERE country_code='CD'), 'dr congo', 'uniranks_backfill'),
  ((SELECT id FROM countries WHERE country_code='BS'), 'bahamas', 'uniranks_backfill'),
  ((SELECT id FROM countries WHERE country_code='GU'), 'guam', 'uniranks_backfill'),
  ((SELECT id FROM countries WHERE country_code='FO'), 'faroe islands', 'uniranks_backfill'),
  ((SELECT id FROM countries WHERE country_code='PF'), 'french polynesia', 'uniranks_backfill'),
  ((SELECT id FROM countries WHERE country_code='VI'), 'united states virgin islands', 'uniranks_backfill')
ON CONFLICT (alias_normalized) DO UPDATE SET country_id = EXCLUDED.country_id;

-- 3) Create the backfill RPC function
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
    SET country_id = r.country_id,
        updated_at = now()
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
