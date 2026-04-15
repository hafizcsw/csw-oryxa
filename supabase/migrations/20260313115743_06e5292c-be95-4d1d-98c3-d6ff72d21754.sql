
-- =============================================
-- GEO VERIFICATION ENGINE v1 — Full Schema
-- =============================================

-- A. geo_verification_jobs
CREATE TABLE public.geo_verification_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending',
  total_count integer NOT NULL DEFAULT 0,
  processed_count integer NOT NULL DEFAULT 0,
  verified_count integer NOT NULL DEFAULT 0,
  flagged_count integer NOT NULL DEFAULT 0,
  unverifiable_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  filters jsonb DEFAULT '{}',
  metrics jsonb DEFAULT '{}'
);

ALTER TABLE public.geo_verification_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on geo_verification_jobs"
  ON public.geo_verification_jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- B. geo_verification_rows
CREATE TABLE public.geo_verification_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.geo_verification_jobs(id) ON DELETE CASCADE,
  university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  university_name text,
  current_country_code text,
  current_city text,
  resolved_country_code text,
  resolved_city text,
  resolved_address text,
  resolved_lat double precision,
  resolved_lon double precision,
  has_reference_city_coordinates boolean,
  country_match boolean,
  city_match boolean,
  coordinates_match boolean,
  confidence numeric(5,2),
  issues text[] NOT NULL DEFAULT '{}',
  resolution_source text,
  status text NOT NULL DEFAULT 'pending',
  raw_data jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_gvr_job_status ON public.geo_verification_rows(job_id, status);
CREATE INDEX idx_gvr_university ON public.geo_verification_rows(university_id);

ALTER TABLE public.geo_verification_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on geo_verification_rows"
  ON public.geo_verification_rows FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- C. university_geo_evidence
CREATE TABLE public.university_geo_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.geo_verification_jobs(id) ON DELETE SET NULL,
  source_type text NOT NULL,
  source_url text,
  entity_type text NOT NULL,
  entity_scope text,
  detected_country_code text,
  detected_city text,
  detected_address text,
  detected_lat double precision,
  detected_lon double precision,
  confidence numeric(5,2),
  signals jsonb,
  raw_excerpt text,
  raw_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_uge_university ON public.university_geo_evidence(university_id);
CREATE INDEX idx_uge_job ON public.university_geo_evidence(job_id);

ALTER TABLE public.university_geo_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on university_geo_evidence"
  ON public.university_geo_evidence FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- D. university_housing_locations
CREATE TABLE public.university_housing_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  name text,
  address text,
  city text,
  country_code text,
  lat double precision,
  lon double precision,
  price_monthly_local numeric,
  currency_code text,
  is_primary boolean NOT NULL DEFAULT false,
  source_url text,
  confidence numeric(5,2),
  status text NOT NULL DEFAULT 'discovered',
  raw_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_uhl_university ON public.university_housing_locations(university_id);

ALTER TABLE public.university_housing_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on university_housing_locations"
  ON public.university_housing_locations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- E. New columns on universities (canonical geo + dorm cache)
ALTER TABLE public.universities
  ADD COLUMN IF NOT EXISTS geo_lat double precision,
  ADD COLUMN IF NOT EXISTS geo_lon double precision,
  ADD COLUMN IF NOT EXISTS geo_source text,
  ADD COLUMN IF NOT EXISTS geo_confidence numeric(5,2),
  ADD COLUMN IF NOT EXISTS has_dorm boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS dorm_lat double precision,
  ADD COLUMN IF NOT EXISTS dorm_lon double precision,
  ADD COLUMN IF NOT EXISTS dorm_address text,
  ADD COLUMN IF NOT EXISTS dorm_price_monthly_local numeric;

-- F. Lock batch RPC for worker dispatch
CREATE OR REPLACE FUNCTION public.rpc_geo_lock_batch(
  p_job_id uuid,
  p_limit integer DEFAULT 2,
  p_lease text DEFAULT 'worker'
)
RETURNS SETOF public.geo_verification_rows
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH batch AS (
    SELECT id FROM geo_verification_rows
    WHERE job_id = p_job_id AND status = 'pending'
    ORDER BY created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE geo_verification_rows r
  SET status = 'processing', processed_at = now()
  FROM batch b
  WHERE r.id = b.id
  RETURNING r.*;
$$;
