
-- Programme entries discovered from university profile snapshots
CREATE TABLE IF NOT EXISTS public.qs_programme_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_profile_id uuid REFERENCES public.qs_entity_profiles(id),
  qs_slug text NOT NULL,
  programme_url text NOT NULL,
  title text,
  degree text,
  level text,
  crawl_status text NOT NULL DEFAULT 'discovered',
  snapshot_id uuid REFERENCES public.crawl_raw_snapshots(id),
  discovery_run_id text,
  crawl_run_id text,
  fetch_attempts int DEFAULT 0,
  fetched_at timestamptz,
  error text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(programme_url)
);

-- Programme extracted details
CREATE TABLE IF NOT EXISTS public.qs_programme_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_entry_id uuid REFERENCES public.qs_programme_entries(id) NOT NULL,
  entity_profile_id uuid REFERENCES public.qs_entity_profiles(id),
  title text,
  degree text,
  level text,
  duration_text text,
  duration_months int,
  study_mode text,
  tuition_domestic numeric,
  tuition_international numeric,
  tuition_currency text,
  start_months int[],
  deadline_raw text,
  admission_requirements jsonb,
  subject_area text,
  school_name text,
  language text,
  intake_info text,
  raw_fields jsonb,
  field_evidence_map jsonb,
  snapshot_id uuid REFERENCES public.crawl_raw_snapshots(id),
  extracted_at timestamptz DEFAULT now(),
  UNIQUE(programme_entry_id)
);

-- Enable RLS but allow service role
ALTER TABLE public.qs_programme_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qs_programme_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.qs_programme_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.qs_programme_details FOR ALL USING (true) WITH CHECK (true);

-- Index for crawl status queries
CREATE INDEX IF NOT EXISTS idx_qs_programme_entries_status ON public.qs_programme_entries(crawl_status);
CREATE INDEX IF NOT EXISTS idx_qs_programme_entries_slug ON public.qs_programme_entries(qs_slug);
