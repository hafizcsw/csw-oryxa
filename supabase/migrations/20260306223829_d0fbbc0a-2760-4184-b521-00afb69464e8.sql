-- Add programme_url to crawl_raw_snapshots for programme-level snapshots
ALTER TABLE crawl_raw_snapshots
  ADD COLUMN IF NOT EXISTS programme_url text;