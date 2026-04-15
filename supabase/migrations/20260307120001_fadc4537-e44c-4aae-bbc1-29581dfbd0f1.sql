-- Add sort_position column for deterministic ordering of tied ranks
ALTER TABLE qs_page_entries ADD COLUMN IF NOT EXISTS sort_position int;

-- Backfill existing data: sort_position = unique sequential based on rank then position_on_page
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY rank_normalized ASC NULLS LAST, position_on_page ASC) as rn
  FROM qs_page_entries
  WHERE acquisition_run_id = 'acq_page1_20260307'
)
UPDATE qs_page_entries SET sort_position = ranked.rn
FROM ranked WHERE qs_page_entries.id = ranked.id;

-- Add unique constraint on sort_position within a run
CREATE UNIQUE INDEX IF NOT EXISTS idx_qpe_sort_position_unique ON qs_page_entries (acquisition_run_id, sort_position);