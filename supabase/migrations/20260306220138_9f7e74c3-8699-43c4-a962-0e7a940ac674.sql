
-- ============================================================
-- QS Enrichment Lane — 12 normalized tables + crawl_state extension
-- ============================================================

-- 1. qs_entity_profiles (main entity registry)
CREATE TABLE public.qs_entity_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid REFERENCES public.universities(id) ON DELETE SET NULL,
  qs_slug text NOT NULL,
  qs_url text NOT NULL,
  entity_type text NOT NULL DEFAULT 'university',
  parent_entity_id uuid REFERENCES public.qs_entity_profiles(id) ON DELETE SET NULL,
  canonical_university_id uuid REFERENCES public.universities(id) ON DELETE SET NULL,
  profile_tier text DEFAULT 'basic',
  name text NOT NULL,
  about_text text,
  official_website text,
  city text,
  country text,
  institution_type text,
  social_links jsonb DEFAULT '{}',
  programme_count_qs int,
  fetched_at timestamptz DEFAULT now(),
  raw_snapshot_id uuid,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT qs_entity_profiles_qs_slug_key UNIQUE (qs_slug),
  CONSTRAINT qs_entity_type_check CHECK (entity_type IN ('university','school','business_school','center','programme'))
);

ALTER TABLE public.qs_entity_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on qs_entity_profiles" ON public.qs_entity_profiles FOR ALL USING (true) WITH CHECK (true);

-- 2. qs_ranking_snapshots
CREATE TABLE public.qs_ranking_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_profile_id uuid NOT NULL REFERENCES public.qs_entity_profiles(id) ON DELETE CASCADE,
  ranking_year int NOT NULL,
  world_rank int,
  overall_score numeric(5,1),
  indicators jsonb DEFAULT '{}',
  ranking_history jsonb DEFAULT '{}',
  subject_rankings jsonb DEFAULT '{}',
  sustainability_rank int,
  regional_rank int,
  fetched_at timestamptz DEFAULT now(),
  UNIQUE (entity_profile_id, ranking_year)
);

ALTER TABLE public.qs_ranking_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on qs_ranking_snapshots" ON public.qs_ranking_snapshots FOR ALL USING (true) WITH CHECK (true);

-- 3. qs_admission_summaries (university-level, NOT programme)
CREATE TABLE public.qs_admission_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_profile_id uuid NOT NULL REFERENCES public.qs_entity_profiles(id) ON DELETE CASCADE,
  level text NOT NULL,
  test_scores jsonb DEFAULT '{}',
  admission_text text,
  fetched_at timestamptz DEFAULT now(),
  UNIQUE (entity_profile_id, level)
);

ALTER TABLE public.qs_admission_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on qs_admission_summaries" ON public.qs_admission_summaries FOR ALL USING (true) WITH CHECK (true);

-- 4. qs_students_staff
CREATE TABLE public.qs_students_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_profile_id uuid NOT NULL REFERENCES public.qs_entity_profiles(id) ON DELETE CASCADE UNIQUE,
  total_students int,
  ug_pct numeric(5,2),
  pg_pct numeric(5,2),
  intl_students int,
  intl_ug_pct numeric(5,2),
  intl_pg_pct numeric(5,2),
  total_faculty int,
  domestic_staff_pct numeric(5,2),
  intl_staff_pct numeric(5,2),
  fetched_at timestamptz DEFAULT now()
);

ALTER TABLE public.qs_students_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on qs_students_staff" ON public.qs_students_staff FOR ALL USING (true) WITH CHECK (true);

-- 5. qs_cost_of_living (dual: structured + text)
CREATE TABLE public.qs_cost_of_living (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_profile_id uuid NOT NULL REFERENCES public.qs_entity_profiles(id) ON DELETE CASCADE UNIQUE,
  accommodation_usd numeric,
  food_usd numeric,
  transport_usd numeric,
  utilities_usd numeric,
  is_approx boolean DEFAULT true,
  cost_of_living_text text,
  currency text DEFAULT 'USD',
  fetched_at timestamptz DEFAULT now()
);

ALTER TABLE public.qs_cost_of_living ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on qs_cost_of_living" ON public.qs_cost_of_living FOR ALL USING (true) WITH CHECK (true);

-- 6. qs_employability
CREATE TABLE public.qs_employability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_profile_id uuid NOT NULL REFERENCES public.qs_entity_profiles(id) ON DELETE CASCADE UNIQUE,
  career_services_text text,
  service_list text[],
  fetched_at timestamptz DEFAULT now()
);

ALTER TABLE public.qs_employability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on qs_employability" ON public.qs_employability FOR ALL USING (true) WITH CHECK (true);

-- 7. qs_media_assets
CREATE TABLE public.qs_media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_profile_id uuid NOT NULL REFERENCES public.qs_entity_profiles(id) ON DELETE CASCADE UNIQUE,
  logo_url text,
  cover_image_url text,
  photo_assets text[] DEFAULT '{}',
  video_assets jsonb DEFAULT '[]',
  brochure_links text[] DEFAULT '{}',
  gallery_present boolean DEFAULT false,
  map_present boolean DEFAULT false,
  fetched_at timestamptz DEFAULT now()
);

ALTER TABLE public.qs_media_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on qs_media_assets" ON public.qs_media_assets FOR ALL USING (true) WITH CHECK (true);

-- 8. qs_campus_locations
CREATE TABLE public.qs_campus_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_profile_id uuid NOT NULL REFERENCES public.qs_entity_profiles(id) ON DELETE CASCADE,
  campus_name text,
  is_main boolean DEFAULT false,
  address text,
  city text,
  country_code text,
  postal_code text,
  campus_image_url text,
  map_link text,
  fetched_at timestamptz DEFAULT now()
);

ALTER TABLE public.qs_campus_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on qs_campus_locations" ON public.qs_campus_locations FOR ALL USING (true) WITH CHECK (true);

-- 9. qs_faqs
CREATE TABLE public.qs_faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_profile_id uuid NOT NULL REFERENCES public.qs_entity_profiles(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text,
  source_links text[] DEFAULT '{}',
  fetched_at timestamptz DEFAULT now()
);

ALTER TABLE public.qs_faqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on qs_faqs" ON public.qs_faqs FOR ALL USING (true) WITH CHECK (true);

-- 10. qs_facilities
CREATE TABLE public.qs_facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_profile_id uuid NOT NULL REFERENCES public.qs_entity_profiles(id) ON DELETE CASCADE UNIQUE,
  facilities_text text,
  fetched_at timestamptz DEFAULT now()
);

ALTER TABLE public.qs_facilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on qs_facilities" ON public.qs_facilities FOR ALL USING (true) WITH CHECK (true);

-- 11. qs_programme_directory_audit
CREATE TABLE public.qs_programme_directory_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_profile_id uuid NOT NULL REFERENCES public.qs_entity_profiles(id) ON DELETE CASCADE,
  directory_programme_count int,
  profile_programme_count int,
  stored_drafts_count int,
  missing_programmes text[] DEFAULT '{}',
  surplus_programmes text[] DEFAULT '{}',
  audit_status text DEFAULT 'incomplete',
  audited_at timestamptz DEFAULT now(),
  CONSTRAINT audit_status_check CHECK (audit_status IN ('pass','mismatch','incomplete'))
);

ALTER TABLE public.qs_programme_directory_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on qs_programme_directory_audit" ON public.qs_programme_directory_audit FOR ALL USING (true) WITH CHECK (true);

-- 12. qs_programme_details (programme-level, separate from university admission)
CREATE TABLE public.qs_programme_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_profile_id uuid NOT NULL REFERENCES public.qs_entity_profiles(id) ON DELETE CASCADE,
  programme_url text NOT NULL,
  title text,
  degree text,
  level text,
  subject_area text,
  school_name text,
  duration text,
  tuition_domestic numeric,
  tuition_international numeric,
  tuition_currency text,
  admission_requirements jsonb DEFAULT '{}',
  start_month text,
  deadline text,
  deadline_confidence text DEFAULT 'fresh',
  study_mode text,
  fetched_at timestamptz DEFAULT now(),
  raw_snapshot_id uuid,
  CONSTRAINT qs_programme_details_url_key UNIQUE (programme_url),
  CONSTRAINT deadline_confidence_check CHECK (deadline_confidence IN ('fresh','stale','malformed'))
);

ALTER TABLE public.qs_programme_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on qs_programme_details" ON public.qs_programme_details FOR ALL USING (true) WITH CHECK (true);

-- Extend uniranks_crawl_state with source-agnostic columns
ALTER TABLE public.uniranks_crawl_state
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'uniranks',
  ADD COLUMN IF NOT EXISTS source_profile_url text,
  ADD COLUMN IF NOT EXISTS entity_type text DEFAULT 'university',
  ADD COLUMN IF NOT EXISTS canonical_university_id uuid,
  ADD COLUMN IF NOT EXISTS parent_entity_id uuid;
