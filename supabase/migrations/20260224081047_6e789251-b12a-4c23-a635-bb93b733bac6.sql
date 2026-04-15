
-- Official Site Crawl Pipeline Tables

-- 1. Jobs table
CREATE TABLE public.official_site_crawl_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','crawling','verifying','publishing','paused','done','failed','cancelled')),
  phase TEXT NOT NULL DEFAULT 'idle' CHECK (phase IN ('idle','crawl','verify','publish')),
  mode TEXT NOT NULL DEFAULT 'pilot' CHECK (mode IN ('pilot10','top500','top1000','all')),
  rank_from INT,
  rank_to INT,
  total_universities INT NOT NULL DEFAULT 0,
  crawled INT NOT NULL DEFAULT 0,
  verified INT NOT NULL DEFAULT 0,
  published INT NOT NULL DEFAULT 0,
  quarantined INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  special_queue INT NOT NULL DEFAULT 0,
  trace_id TEXT,
  requested_by UUID,
  kill_switch BOOLEAN NOT NULL DEFAULT false,
  stats_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 2. Job rows (one per university per job)
CREATE TABLE public.official_site_crawl_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.official_site_crawl_jobs(id) ON DELETE CASCADE,
  university_id UUID NOT NULL,
  university_name TEXT,
  website TEXT,
  crawl_status TEXT NOT NULL DEFAULT 'queued' CHECK (crawl_status IN ('queued','planning','fetching','extracting','verifying','verified','published','quarantined','special','failed')),
  crawl_strategy TEXT DEFAULT 'generic',
  coverage_plan JSONB DEFAULT '{}',
  coverage_result JSONB DEFAULT '{}',
  reason_codes TEXT[] DEFAULT '{}',
  error_message TEXT,
  artifacts_path TEXT,
  extracted_summary JSONB DEFAULT '{}',
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_osc_rows_job_status ON public.official_site_crawl_rows(job_id, crawl_status);
CREATE INDEX idx_osc_rows_university ON public.official_site_crawl_rows(university_id);

-- 3. Field observations (evidence-based)
CREATE TABLE public.official_site_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.official_site_crawl_jobs(id),
  row_id UUID REFERENCES public.official_site_crawl_rows(id) ON DELETE CASCADE,
  university_id UUID NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'university' CHECK (entity_type IN ('university','program','housing','contact')),
  entity_id UUID,
  field_name TEXT NOT NULL,
  value_raw TEXT,
  value_normalized TEXT,
  evidence_snippet TEXT,
  source_url TEXT,
  confidence NUMERIC(3,2) DEFAULT 0.5,
  cycle_detected TEXT,
  currency TEXT,
  billing_period TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','quarantined','verified','rejected','published')),
  reason_code TEXT,
  trace_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_osc_obs_row ON public.official_site_observations(row_id);
CREATE INDEX idx_osc_obs_uni_field ON public.official_site_observations(university_id, field_name);

-- 4. Publish batches
CREATE TABLE public.official_site_publish_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.official_site_crawl_jobs(id),
  batch_type TEXT NOT NULL DEFAULT 'low_risk' CHECK (batch_type IN ('low_risk','medium_risk','high_risk')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','applying','done','rolled_back','failed')),
  total_items INT NOT NULL DEFAULT 0,
  applied_items INT NOT NULL DEFAULT 0,
  skipped_items INT NOT NULL DEFAULT 0,
  failed_items INT NOT NULL DEFAULT 0,
  requested_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 5. Special crawl queue
CREATE TABLE public.official_site_special_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL,
  university_name TEXT,
  website TEXT,
  reason_code TEXT NOT NULL,
  strategy_needed TEXT,
  priority INT DEFAULT 50,
  retry_after TIMESTAMPTZ,
  attempts INT DEFAULT 0,
  last_error TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','resolved','abandoned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_osc_special_status ON public.official_site_special_queue(status, priority);

-- 6. RPC: Pick batch of rows for processing
CREATE OR REPLACE FUNCTION public.rpc_osc_pick_batch(
  p_job_id UUID,
  p_batch_size INT DEFAULT 10,
  p_worker_id TEXT DEFAULT 'default'
)
RETURNS SETOF public.official_site_crawl_rows
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT id FROM public.official_site_crawl_rows
    WHERE job_id = p_job_id
      AND crawl_status = 'queued'
      AND (locked_at IS NULL OR locked_at < now() - interval '5 minutes')
    ORDER BY created_at
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.official_site_crawl_rows r
  SET locked_at = now(),
      locked_by = p_worker_id,
      crawl_status = 'planning',
      updated_at = now()
  FROM picked p
  WHERE r.id = p.id
  RETURNING r.*;
END;
$$;

-- 7. RPC: Update row status
CREATE OR REPLACE FUNCTION public.rpc_osc_update_row(
  p_row_id UUID,
  p_status TEXT,
  p_coverage_result JSONB DEFAULT NULL,
  p_extracted_summary JSONB DEFAULT NULL,
  p_reason_codes TEXT[] DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_artifacts_path TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.official_site_crawl_rows
  SET crawl_status = p_status,
      coverage_result = COALESCE(p_coverage_result, coverage_result),
      extracted_summary = COALESCE(p_extracted_summary, extracted_summary),
      reason_codes = COALESCE(p_reason_codes, reason_codes),
      error_message = COALESCE(p_error_message, error_message),
      artifacts_path = COALESCE(p_artifacts_path, artifacts_path),
      locked_at = NULL,
      locked_by = NULL,
      updated_at = now()
  WHERE id = p_row_id;

  -- Update job counters
  PERFORM rpc_osc_sync_job_counters(
    (SELECT job_id FROM public.official_site_crawl_rows WHERE id = p_row_id)
  );
END;
$$;

-- 8. RPC: Sync job counters from rows
CREATE OR REPLACE FUNCTION public.rpc_osc_sync_job_counters(p_job_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.official_site_crawl_jobs j
  SET
    crawled = (SELECT count(*) FROM official_site_crawl_rows WHERE job_id = p_job_id AND crawl_status NOT IN ('queued','planning','fetching')),
    verified = (SELECT count(*) FROM official_site_crawl_rows WHERE job_id = p_job_id AND crawl_status IN ('verified','published')),
    published = (SELECT count(*) FROM official_site_crawl_rows WHERE job_id = p_job_id AND crawl_status = 'published'),
    quarantined = (SELECT count(*) FROM official_site_crawl_rows WHERE job_id = p_job_id AND crawl_status = 'quarantined'),
    failed = (SELECT count(*) FROM official_site_crawl_rows WHERE job_id = p_job_id AND crawl_status = 'failed'),
    special_queue = (SELECT count(*) FROM official_site_crawl_rows WHERE job_id = p_job_id AND crawl_status = 'special'),
    updated_at = now()
  WHERE id = p_job_id;
END;
$$;

-- RLS: admin-only access
ALTER TABLE public.official_site_crawl_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_site_crawl_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_site_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_site_publish_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_site_special_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.official_site_crawl_jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.official_site_crawl_rows FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.official_site_observations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.official_site_publish_batches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.official_site_special_queue FOR ALL USING (true) WITH CHECK (true);
