
-- ============================================================
-- QS Schema Fixes — 6 mandatory adjustments
-- ============================================================

-- 1. crawl_raw_snapshots (generic, not provider-specific)
CREATE TABLE public.crawl_raw_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,                    -- 'qs' | 'uniranks' | 'official_site'
  source_url text NOT NULL,
  fetch_method text DEFAULT 'raw',         -- 'raw' | 'firecrawl'
  content_type text DEFAULT 'html',
  content_hash text,
  raw_html text,
  raw_markdown text,
  fetched_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);
ALTER TABLE public.crawl_raw_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on crawl_raw_snapshots" ON public.crawl_raw_snapshots FOR ALL USING (true) WITH CHECK (true);

-- 2. Fix qs_entity_profiles.raw_snapshot_id to point to crawl_raw_snapshots
ALTER TABLE public.qs_entity_profiles
  DROP COLUMN IF EXISTS raw_snapshot_id;
ALTER TABLE public.qs_entity_profiles
  ADD COLUMN raw_snapshot_id uuid REFERENCES public.crawl_raw_snapshots(id) ON DELETE SET NULL;

-- 3. Fix qs_programme_details.raw_snapshot_id
ALTER TABLE public.qs_programme_details
  DROP COLUMN IF EXISTS raw_snapshot_id;
ALTER TABLE public.qs_programme_details
  ADD COLUMN raw_snapshot_id uuid REFERENCES public.crawl_raw_snapshots(id) ON DELETE SET NULL;

-- 4. qs_student_life
CREATE TABLE public.qs_student_life (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_profile_id uuid NOT NULL REFERENCES public.qs_entity_profiles(id) ON DELETE CASCADE UNIQUE,
  student_life_text text,
  dorms_available boolean,
  counselling_available boolean,
  clubs_societies text[],
  fetched_at timestamptz DEFAULT now()
);
ALTER TABLE public.qs_student_life ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on qs_student_life" ON public.qs_student_life FOR ALL USING (true) WITH CHECK (true);

-- 5. qs_similar_entities
CREATE TABLE public.qs_similar_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_profile_id uuid NOT NULL REFERENCES public.qs_entity_profiles(id) ON DELETE CASCADE,
  similar_qs_slug text NOT NULL,
  similar_name text,
  similar_url text,
  similarity_context text,            -- e.g. 'qs_suggested'
  fetched_at timestamptz DEFAULT now(),
  UNIQUE (entity_profile_id, similar_qs_slug)
);
ALTER TABLE public.qs_similar_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on qs_similar_entities" ON public.qs_similar_entities FOR ALL USING (true) WITH CHECK (true);

-- 6. Fix qs_cost_of_living columns: remove _usd suffix, add proper naming
ALTER TABLE public.qs_cost_of_living
  RENAME COLUMN accommodation_usd TO accommodation_amount;
ALTER TABLE public.qs_cost_of_living
  RENAME COLUMN food_usd TO food_amount;
ALTER TABLE public.qs_cost_of_living
  RENAME COLUMN transport_usd TO transport_amount;
ALTER TABLE public.qs_cost_of_living
  RENAME COLUMN utilities_usd TO utilities_amount;
ALTER TABLE public.qs_cost_of_living
  ADD COLUMN IF NOT EXISTS raw_text text;

-- 7. Expand programme dates model
ALTER TABLE public.qs_programme_details
  DROP COLUMN IF EXISTS start_month;
ALTER TABLE public.qs_programme_details
  ADD COLUMN start_months text[] DEFAULT '{}';
ALTER TABLE public.qs_programme_details
  RENAME COLUMN deadline TO deadline_raw;
ALTER TABLE public.qs_programme_details
  ADD COLUMN IF NOT EXISTS deadlines_jsonb jsonb DEFAULT '[]';

-- 8. qs_section_observations (DoD persistence)
CREATE TABLE public.qs_section_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_profile_id uuid NOT NULL REFERENCES public.qs_entity_profiles(id) ON DELETE CASCADE,
  crawl_run_id text,
  section_name text NOT NULL,
  status text NOT NULL,                -- 'extracted' | 'not_present' | 'explicitly_ignored' | 'quarantined' | 'requires_js'
  ignore_reason text,
  quarantine_reason text,
  data_sample jsonb,
  observed_at timestamptz DEFAULT now(),
  CONSTRAINT section_status_check CHECK (status IN ('extracted','not_present','explicitly_ignored','quarantined','requires_js'))
);
ALTER TABLE public.qs_section_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on qs_section_observations" ON public.qs_section_observations FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_qs_section_obs_entity ON public.qs_section_observations(entity_profile_id);
CREATE INDEX idx_qs_section_obs_section ON public.qs_section_observations(section_name, status);
