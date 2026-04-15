-- ============================================================
-- Website Enrichment Jobs & Rows Schema
-- ============================================================

-- Job-level table
CREATE TABLE IF NOT EXISTS public.website_enrichment_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','paused','completed','failed','cancelled')),
  filter_criteria jsonb NOT NULL DEFAULT '{}',
  total_rows int NOT NULL DEFAULT 0,
  processed_rows int NOT NULL DEFAULT 0,
  matched_rows int NOT NULL DEFAULT 0,
  review_rows int NOT NULL DEFAULT 0,
  failed_rows int NOT NULL DEFAULT 0,
  skipped_rows int NOT NULL DEFAULT 0,
  batch_size int NOT NULL DEFAULT 20,
  provider_config jsonb NOT NULL DEFAULT '{"providers":["openalex"],"enable_ror":false,"enable_wikidata":false}',
  error_summary text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  paused_at timestamptz,
  completed_at timestamptz,
  last_activity_at timestamptz DEFAULT now(),
  trace_id text DEFAULT 'WE-' || substr(gen_random_uuid()::text, 1, 8)
);

-- Row-level results table
CREATE TABLE IF NOT EXISTS public.website_enrichment_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.website_enrichment_jobs(id) ON DELETE CASCADE,
  university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  university_name text,
  country_code text,
  city text,
  
  -- Enrichment results
  official_website_url text,
  official_website_domain text,
  match_source text CHECK (match_source IN ('openalex','ror','wikidata','web','manual')),
  confidence_score int CHECK (confidence_score >= 0 AND confidence_score <= 100),
  match_reason text,
  matched_entity_name text,
  matched_country text,
  matched_city text,
  
  -- Status
  enrichment_status text NOT NULL DEFAULT 'pending' CHECK (enrichment_status IN ('pending','matched','review','failed','skipped','approved','rejected')),
  needs_manual_review boolean NOT NULL DEFAULT false,
  
  -- Review fields
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  review_action text CHECK (review_action IN ('approve','edit','reject','no_website')),
  
  -- Provider data
  raw_provider_response jsonb,
  provider_candidates jsonb, -- Array of candidate matches
  
  -- Retry
  attempt_count int NOT NULL DEFAULT 0,
  last_error text,
  
  -- Timestamps
  enriched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Prevent duplicate rows per job
  UNIQUE(job_id, university_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_we_rows_job_status ON public.website_enrichment_rows(job_id, enrichment_status);
CREATE INDEX IF NOT EXISTS idx_we_rows_review ON public.website_enrichment_rows(needs_manual_review) WHERE needs_manual_review = true;
CREATE INDEX IF NOT EXISTS idx_we_rows_university ON public.website_enrichment_rows(university_id);
CREATE INDEX IF NOT EXISTS idx_we_jobs_status ON public.website_enrichment_jobs(status);

-- RLS
ALTER TABLE public.website_enrichment_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_enrichment_rows ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "admin_all_we_jobs" ON public.website_enrichment_jobs
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "admin_all_we_rows" ON public.website_enrichment_rows
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- Service role bypass for edge functions
CREATE POLICY "service_role_we_jobs" ON public.website_enrichment_jobs
  FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_we_rows" ON public.website_enrichment_rows
  FOR ALL TO service_role USING (true);

-- RPC: Pick next batch of universities for a job
CREATE OR REPLACE FUNCTION public.rpc_we_pick_batch(
  p_job_id uuid,
  p_batch_size int DEFAULT 20
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_filter jsonb;
  v_inserted int;
BEGIN
  -- Get job filter
  SELECT filter_criteria INTO v_filter
  FROM website_enrichment_jobs
  WHERE id = p_job_id AND status IN ('queued','running');
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Insert next batch of universities that don't have rows yet
  WITH candidates AS (
    SELECT u.id, u.name_en, u.country_code, u.city
    FROM universities u
    WHERE u.website IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM website_enrichment_rows r
        WHERE r.university_id = u.id AND r.job_id = p_job_id
      )
      -- Apply optional filters
      AND (v_filter->>'country_code' IS NULL OR u.country_code = v_filter->>'country_code')
      AND (v_filter->>'name_contains' IS NULL OR u.name_en ILIKE '%' || (v_filter->>'name_contains') || '%')
    ORDER BY u.ranking NULLS LAST, u.name_en
    LIMIT p_batch_size
  )
  INSERT INTO website_enrichment_rows (job_id, university_id, university_name, country_code, city)
  SELECT p_job_id, c.id, c.name_en, c.country_code, c.city
  FROM candidates c
  ON CONFLICT (job_id, university_id) DO NOTHING;
  
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  
  -- Update job total
  UPDATE website_enrichment_jobs
  SET total_rows = (SELECT COUNT(*) FROM website_enrichment_rows WHERE job_id = p_job_id),
      last_activity_at = now()
  WHERE id = p_job_id;
  
  RETURN v_inserted;
END;
$$;

-- RPC: Get pending rows for processing
CREATE OR REPLACE FUNCTION public.rpc_we_lock_batch(
  p_job_id uuid,
  p_limit int DEFAULT 10
)
RETURNS SETOF website_enrichment_rows
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE website_enrichment_rows
  SET enrichment_status = 'pending', attempt_count = attempt_count + 1, updated_at = now()
  WHERE id IN (
    SELECT id FROM website_enrichment_rows
    WHERE job_id = p_job_id
      AND enrichment_status = 'pending'
      AND attempt_count < 3
    ORDER BY created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;