
-- Phase A: Complete geo verification schema gaps

-- 1. Create geo_verification_decisions audit table
CREATE TABLE IF NOT EXISTS public.geo_verification_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_type text NOT NULL,
  actor_id uuid NOT NULL,
  target_university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  target_row_id uuid REFERENCES public.geo_verification_rows(id) ON DELETE SET NULL,
  target_housing_id uuid REFERENCES public.university_housing_locations(id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.geo_verification_jobs(id) ON DELETE SET NULL,
  trace_id text,
  before_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Add missing columns
ALTER TABLE public.geo_verification_rows ADD COLUMN IF NOT EXISTS trace_id text;
ALTER TABLE public.university_geo_evidence ADD COLUMN IF NOT EXISTS content_hash text;

-- 3. Add unique constraint on geo_verification_rows(job_id, university_id)
CREATE UNIQUE INDEX IF NOT EXISTS uq_gvr_job_university 
  ON public.geo_verification_rows(job_id, university_id);

-- 4. Add unique index on university_geo_evidence(university_id, content_hash) for dedupe
CREATE UNIQUE INDEX IF NOT EXISTS uq_uge_university_content_hash 
  ON public.university_geo_evidence(university_id, content_hash) 
  WHERE content_hash IS NOT NULL;

-- 5. Partial unique index on university_housing_locations: only one primary per university
CREATE UNIQUE INDEX IF NOT EXISTS uq_uhl_primary_per_university 
  ON public.university_housing_locations(university_id) 
  WHERE is_primary = true;

-- 6. Index on decisions for lookups
CREATE INDEX IF NOT EXISTS idx_gvd_university ON public.geo_verification_decisions(target_university_id);
CREATE INDEX IF NOT EXISTS idx_gvd_job ON public.geo_verification_decisions(job_id);

-- 7. Enable RLS on decisions table
ALTER TABLE public.geo_verification_decisions ENABLE ROW LEVEL SECURITY;

-- 8. Admin-only RLS policy on decisions
CREATE POLICY "Admin full access on geo_verification_decisions"
  ON public.geo_verification_decisions
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
