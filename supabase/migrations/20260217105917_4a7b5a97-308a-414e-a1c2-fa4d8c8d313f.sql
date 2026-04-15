
-- 1) Catalog table: source of truth for UniRanks import
CREATE TABLE IF NOT EXISTS public.uniranks_university_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uniranks_slug text NOT NULL UNIQUE,
  uniranks_profile_url text NOT NULL,
  uniranks_name text NOT NULL,
  country text NULL,
  list_type text NOT NULL DEFAULT 'all',
  rank_position int NULL,
  score numeric NULL,
  logo_url text NULL,
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  match_status text NOT NULL DEFAULT 'unmatched',
  matched_university_id uuid NULL REFERENCES public.universities(id),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Import runs: audit trail for each import session
CREATE TABLE IF NOT EXISTS public.uniranks_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'running',
  list_type text NOT NULL DEFAULT 'all',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz NULL,
  pages_done int NOT NULL DEFAULT 0,
  catalog_upserts int NOT NULL DEFAULT 0,
  university_upserts int NOT NULL DEFAULT 0,
  trace_id text NOT NULL,
  last_error jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3) RLS
ALTER TABLE public.uniranks_university_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uniranks_import_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_only_catalog" ON public.uniranks_university_catalog
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "admin_only_runs" ON public.uniranks_import_runs
  FOR ALL USING (public.is_admin(auth.uid()));
