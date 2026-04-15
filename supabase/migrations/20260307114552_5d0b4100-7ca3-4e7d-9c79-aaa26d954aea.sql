
-- ============================================================
-- QS Page-Order Acquisition — Revision 2.1 Migration
-- ============================================================

-- 1. qs_page_entries: main staging table for page-order crawl
CREATE TABLE public.qs_page_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'qs_rankings',
  page_number int NOT NULL,
  position_on_page int NOT NULL,
  global_position int NOT NULL,
  rank_raw text NOT NULL,
  rank_normalized int,
  rank_source text NOT NULL DEFAULT 'extracted',
  qs_slug text UNIQUE NOT NULL,
  display_name text NOT NULL,
  source_profile_url text UNIQUE NOT NULL,
  entity_type text NOT NULL DEFAULT 'university',
  crawl_status text NOT NULL DEFAULT 'discovered',
  results_per_page_observed int,
  discovery_method text NOT NULL DEFAULT 'page_scrape',
  is_duplicate_seen boolean NOT NULL DEFAULT false,
  duplicate_of_slug text,
  matched_university_id uuid,
  match_method text,
  match_confidence numeric(3,2),
  acquisition_run_id text NOT NULL,
  profile_run_id text,
  profile_error text,
  profile_attempts int NOT NULL DEFAULT 0,
  profile_snapshot_id uuid,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  profile_fetched_at timestamptz,
  linked_at timestamptz,
  trace_id text,
  CONSTRAINT qs_page_entries_crawl_status_check CHECK (
    crawl_status IN ('discovered','profile_pending','profile_fetching','profile_done','profile_failed','linked','linked_ambiguous','published')
  ),
  CONSTRAINT qs_page_entries_rank_source_check CHECK (
    rank_source IN ('extracted','fallback_position')
  )
);

CREATE INDEX idx_qpe_crawl_status ON public.qs_page_entries(crawl_status);
CREATE INDEX idx_qpe_page_order ON public.qs_page_entries(page_number, position_on_page);
CREATE INDEX idx_qpe_global_pos ON public.qs_page_entries(global_position);
CREATE INDEX idx_qpe_acq_run ON public.qs_page_entries(acquisition_run_id);
CREATE INDEX idx_qpe_profile_run ON public.qs_page_entries(profile_run_id);
CREATE INDEX idx_qpe_rank_norm ON public.qs_page_entries(rank_normalized);

-- 2. qs_page_proofs: evidence per page
CREATE TABLE public.qs_page_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_number int NOT NULL,
  page_url text NOT NULL,
  snapshot_id uuid,
  entry_count int NOT NULL DEFAULT 0,
  first_slug text,
  last_slug text,
  first_rank_raw text,
  last_rank_raw text,
  first_rank_normalized int,
  last_rank_normalized int,
  results_per_page_observed int,
  valid_rank_count int NOT NULL DEFAULT 0,
  markdown_length int NOT NULL DEFAULT 0,
  has_next_page boolean,
  is_valid boolean NOT NULL DEFAULT true,
  shell_reason text,
  parse_warnings text[],
  acquisition_run_id text NOT NULL,
  trace_id text,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  fetch_duration_ms int
);

CREATE UNIQUE INDEX idx_qpp_run_page ON public.qs_page_proofs(acquisition_run_id, page_number);

-- 3. qs_acquisition_cursor: singleton state + checkpoint
CREATE TABLE public.qs_acquisition_cursor (
  id text PRIMARY KEY DEFAULT 'qs_acq',
  run_id text,
  phase text NOT NULL DEFAULT 'idle',
  status text NOT NULL DEFAULT 'idle',
  current_page int NOT NULL DEFAULT 0,
  total_pages_estimated int,
  total_entries int NOT NULL DEFAULT 0,
  pages_with_zero_entries int NOT NULL DEFAULT 0,
  profile_cursor_position int NOT NULL DEFAULT 0,
  profile_batch_size int NOT NULL DEFAULT 10,
  started_at timestamptz,
  last_tick_at timestamptz,
  tick_count int NOT NULL DEFAULT 0,
  consecutive_errors int NOT NULL DEFAULT 0,
  max_consecutive_errors int NOT NULL DEFAULT 5,
  pages_per_tick int NOT NULL DEFAULT 1,
  log text[] NOT NULL DEFAULT '{}',
  CONSTRAINT qs_acq_phase_check CHECK (phase IN ('idle','acquisition','profile_crawl','done')),
  CONSTRAINT qs_acq_status_check CHECK (status IN ('idle','running','paused','done','error'))
);

-- Insert singleton cursor row
INSERT INTO public.qs_acquisition_cursor (id) VALUES ('qs_acq');

-- RLS: admin-only access
ALTER TABLE public.qs_page_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qs_page_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qs_acquisition_cursor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on qs_page_entries"
  ON public.qs_page_entries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin full access on qs_page_proofs"
  ON public.qs_page_proofs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin full access on qs_acquisition_cursor"
  ON public.qs_acquisition_cursor FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Service role bypass for edge functions
CREATE POLICY "Service role bypass qs_page_entries"
  ON public.qs_page_entries FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role bypass qs_page_proofs"
  ON public.qs_page_proofs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role bypass qs_acquisition_cursor"
  ON public.qs_acquisition_cursor FOR ALL TO service_role USING (true) WITH CHECK (true);
