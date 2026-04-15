
-- ============================================================
-- G1: university_media (gallery/logos/assets)
-- ============================================================
CREATE TABLE public.university_media (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  housing_id uuid NULL, -- FK added after university_housing created
  media_kind text NOT NULL DEFAULT 'image',
  image_type text NOT NULL DEFAULT 'gallery'
    CHECK (image_type IN ('logo','hero','gallery','dormitory','campus','city','classroom','lab','other')),
  storage_bucket text,
  storage_path text,
  public_url text,
  source_url text NOT NULL,
  source_page_url text NOT NULL DEFAULT '',
  alt_text text,
  sort_order integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  sha256 text,
  width integer,
  height integer,
  source_name text,
  fetched_at timestamptz,
  parser_version text,
  trace_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_university_media_source ON public.university_media (university_id, source_url);
CREATE INDEX idx_university_media_uni ON public.university_media (university_id);
CREATE INDEX idx_university_media_type ON public.university_media (image_type);
CREATE INDEX idx_university_media_source_name ON public.university_media (source_name);
CREATE INDEX idx_university_media_housing ON public.university_media (housing_id) WHERE housing_id IS NOT NULL;

ALTER TABLE public.university_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view university media"
  ON public.university_media FOR SELECT USING (true);

CREATE POLICY "Admins can manage university media"
  ON public.university_media FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin')
  );

-- ============================================================
-- G2: university_housing (1:N dorm/housing)
-- ============================================================
CREATE TABLE public.university_housing (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  source_name text,
  source_url text,
  housing_type text NOT NULL DEFAULT 'dormitory'
    CHECK (housing_type IN ('dormitory','off_campus','near_campus','apartment','other')),
  on_campus boolean NOT NULL DEFAULT true,
  title text,
  summary text,
  capacity_total integer,
  dormitories_count integer,
  accommodation_during_exams boolean,
  temporary_accommodation boolean,
  gender_policy text,
  facilities jsonb DEFAULT '[]'::jsonb,
  required_documents jsonb DEFAULT '[]'::jsonb,
  settlement_conditions jsonb DEFAULT '{}'::jsonb,
  pricing_notes text,
  contact_name text,
  contact_phone text,
  contact_hours text,
  confidence numeric,
  fetched_at timestamptz,
  parser_version text,
  trace_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_university_housing_uni ON public.university_housing (university_id);
CREATE INDEX idx_university_housing_type ON public.university_housing (housing_type);
CREATE INDEX idx_university_housing_source ON public.university_housing (source_name);

ALTER TABLE public.university_housing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view university housing"
  ON public.university_housing FOR SELECT USING (true);

CREATE POLICY "Admins can manage university housing"
  ON public.university_housing FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin')
  );

-- Now add FK from university_media.housing_id
ALTER TABLE public.university_media
  ADD CONSTRAINT fk_university_media_housing
  FOREIGN KEY (housing_id) REFERENCES public.university_housing(id) ON DELETE SET NULL;

-- ============================================================
-- G3: Extend price_observations
-- ============================================================
ALTER TABLE public.price_observations
  ADD COLUMN IF NOT EXISTS price_type text DEFAULT 'tuition'
    CHECK (price_type IN ('tuition','dormitory','living_cost','application_fee','insurance','registration_fee','other')),
  ADD COLUMN IF NOT EXISTS period text
    CHECK (period IN ('year','semester','month','one_time','week','day','other')),
  ADD COLUMN IF NOT EXISTS amount_min numeric,
  ADD COLUMN IF NOT EXISTS amount_max numeric,
  ADD COLUMN IF NOT EXISTS conditions_note text;

CREATE INDEX IF NOT EXISTS idx_price_obs_uni_type_period ON public.price_observations (university_id, price_type, period);
CREATE INDEX IF NOT EXISTS idx_price_obs_prog_type_period ON public.price_observations (program_id, price_type, period) WHERE program_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_price_obs_source_url ON public.price_observations (source_url);

-- ============================================================
-- G4: Extend raw_pages
-- ============================================================
ALTER TABLE public.raw_pages
  ADD COLUMN IF NOT EXISTS source_name text,
  ADD COLUMN IF NOT EXISTS page_type text,
  ADD COLUMN IF NOT EXISTS trace_id text,
  ADD COLUMN IF NOT EXISTS parser_version text;

CREATE INDEX IF NOT EXISTS idx_raw_pages_source_type ON public.raw_pages (source_name, page_type, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_pages_trace ON public.raw_pages (trace_id) WHERE trace_id IS NOT NULL;

-- ============================================================
-- G5: university_external_ids (source mapping)
-- ============================================================
CREATE TABLE public.university_external_ids (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  university_id uuid REFERENCES public.universities(id) ON DELETE SET NULL,
  source_name text NOT NULL,
  external_id text,
  source_url text NOT NULL,
  canonical_source_url text,
  match_method text CHECK (match_method IN ('exact_url','slug','name_city','manual','fuzzy')),
  match_confidence numeric,
  is_primary_for_source boolean NOT NULL DEFAULT true,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  trace_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_ext_ids_source_url ON public.university_external_ids (source_name, source_url);
CREATE UNIQUE INDEX uq_ext_ids_source_extid ON public.university_external_ids (source_name, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_ext_ids_uni_source ON public.university_external_ids (university_id, source_name);

ALTER TABLE public.university_external_ids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view external ids"
  ON public.university_external_ids FOR SELECT USING (true);

CREATE POLICY "Admins can manage external ids"
  ON public.university_external_ids FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin')
  );
