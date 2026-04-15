
-- ============================================
-- Door 2: UniRanks Harvester — State Tables
-- ============================================

-- 1) uniranks_crawl_state: Per-university stage tracking
CREATE TABLE public.uniranks_crawl_state (
  university_id TEXT NOT NULL PRIMARY KEY,
  uniranks_profile_url TEXT,
  stage TEXT NOT NULL DEFAULT 'profile_pending'
    CHECK (stage IN (
      'profile_pending','profile_fetching','profile_done',
      'programs_pending','programs_fetching','programs_done',
      'details_pending','details_fetching','details_done',
      'done','quarantined'
    )),
  locked_until TIMESTAMPTZ,
  locked_by TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  retry_budget INT NOT NULL DEFAULT 3,
  quarantine_reason TEXT,
  quarantined_at TIMESTAMPTZ,
  last_ok_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crawl_state_stage ON public.uniranks_crawl_state(stage);
CREATE INDEX idx_crawl_state_locked ON public.uniranks_crawl_state(locked_until) WHERE locked_until IS NOT NULL;

ALTER TABLE public.uniranks_crawl_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only_crawl_state" ON public.uniranks_crawl_state
  FOR ALL USING (public.is_admin(auth.uid()));

-- 2) uniranks_page_snapshots: Snapshot-first storage
CREATE TABLE public.uniranks_page_snapshots (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  university_id TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  content_hash TEXT,
  status_code INT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_markdown TEXT,
  raw_html_ref TEXT, -- storage path if too large
  page_type TEXT DEFAULT 'profile', -- profile/programs_list/program_detail
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_snapshots_url_hash ON public.uniranks_page_snapshots(normalized_url, content_hash);
CREATE INDEX idx_snapshots_university ON public.uniranks_page_snapshots(university_id);

ALTER TABLE public.uniranks_page_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only_snapshots" ON public.uniranks_page_snapshots
  FOR ALL USING (public.is_admin(auth.uid()));

-- 3) uniranks_step_runs: Step-level idempotency + status tracking
CREATE TABLE public.uniranks_step_runs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  university_id TEXT NOT NULL,
  step_key TEXT NOT NULL, -- e.g. 'profile_fetch', 'about_parse', 'programs_discover'
  stage TEXT NOT NULL,
  section TEXT, -- sub-section: 'profile_main','about','logo','widgets','programs_list'
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','ok','not_present','js_required','fetch_error','parse_error','skipped')),
  details_json JSONB DEFAULT '{}',
  trace_id TEXT,
  snapshot_id BIGINT REFERENCES public.uniranks_page_snapshots(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_step_runs_key ON public.uniranks_step_runs(university_id, step_key, stage);
CREATE INDEX idx_step_runs_status ON public.uniranks_step_runs(status);

ALTER TABLE public.uniranks_step_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only_step_runs" ON public.uniranks_step_runs
  FOR ALL USING (public.is_admin(auth.uid()));

-- 4) Door2 settings in crawl_settings
INSERT INTO public.crawl_settings (key, value, updated_at) VALUES
  ('door2_enabled', '{"enabled": false}'::jsonb, now()),
  ('door2_config', '{
    "pause": false,
    "max_units_per_tick": 5,
    "retry_budget_default": 3,
    "lock_seconds": 120,
    "seed_from_ranking": false
  }'::jsonb, now())
ON CONFLICT (key) DO NOTHING;

-- 5) Updated_at trigger for crawl_state
CREATE OR REPLACE FUNCTION public.update_uniranks_crawl_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_uniranks_crawl_state_updated_at
  BEFORE UPDATE ON public.uniranks_crawl_state
  FOR EACH ROW EXECUTE FUNCTION public.update_uniranks_crawl_state_updated_at();
