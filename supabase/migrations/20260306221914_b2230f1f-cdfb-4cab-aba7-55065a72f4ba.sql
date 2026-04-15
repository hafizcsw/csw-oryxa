-- Add source column to uniranks_crawl_state
ALTER TABLE uniranks_crawl_state ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'uniranks';
-- Add qs_slug for QS-sourced crawl state records
ALTER TABLE uniranks_crawl_state ADD COLUMN IF NOT EXISTS qs_slug text;
-- Add entity_type for QS entities
ALTER TABLE uniranks_crawl_state ADD COLUMN IF NOT EXISTS entity_type text DEFAULT 'university';

-- Index for source-based queries
CREATE INDEX IF NOT EXISTS idx_uniranks_crawl_state_source ON uniranks_crawl_state (source);