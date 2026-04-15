-- 1) Add mock markers (additive, safe)
ALTER TABLE institution_rankings
  ADD COLUMN IF NOT EXISTS is_mock boolean NOT NULL DEFAULT false;

ALTER TABLE institution_rankings
  ADD COLUMN IF NOT EXISTS data_source text NOT NULL DEFAULT 'manual';

-- 2) Helpful indexes (safe)
CREATE INDEX IF NOT EXISTS idx_institution_rankings_institution_id
  ON institution_rankings (institution_id);

CREATE INDEX IF NOT EXISTS idx_institution_rankings_system_year
  ON institution_rankings (ranking_system, ranking_year);

CREATE INDEX IF NOT EXISTS idx_institution_rankings_lookup
  ON institution_rankings (institution_id, ranking_system, ranking_year);

CREATE INDEX IF NOT EXISTS idx_institution_rankings_is_mock
  ON institution_rankings (is_mock);