
-- ORX Crawl Jobs: tracks per-entity crawl lifecycle
CREATE TABLE public.orx_crawl_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('university','program','country')),
  entity_id TEXT NOT NULL,
  job_type TEXT NOT NULL DEFAULT 'full' CHECK (job_type IN ('full','rescore','repromote','evidence_only')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('idle','queued','running','paused','completed','failed','cancelled')),
  current_stage TEXT DEFAULT 'discover' CHECK (current_stage IN ('discover','fetch','extract','normalize','promote','score','publish_ready')),
  pages_discovered INT NOT NULL DEFAULT 0,
  pages_fetched INT NOT NULL DEFAULT 0,
  pages_processed INT NOT NULL DEFAULT 0,
  pages_total_estimate INT DEFAULT 0,
  evidence_created INT NOT NULL DEFAULT 0,
  facts_created INT NOT NULL DEFAULT 0,
  score_updated BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ,
  last_error TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  triggered_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for quick lookups
CREATE INDEX idx_orx_crawl_jobs_entity ON public.orx_crawl_jobs(entity_id);
CREATE INDEX idx_orx_crawl_jobs_status ON public.orx_crawl_jobs(status);

-- ORX Crawl Audit Log
CREATE TABLE public.orx_crawl_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.orx_crawl_jobs(id) ON DELETE CASCADE,
  entity_id TEXT,
  action TEXT NOT NULL,
  actor UUID,
  reason TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orx_crawl_audit_job ON public.orx_crawl_audit(job_id);
CREATE INDEX idx_orx_crawl_audit_entity ON public.orx_crawl_audit(entity_id);

-- RLS
ALTER TABLE public.orx_crawl_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orx_crawl_audit ENABLE ROW LEVEL SECURITY;

-- Only admins (via service role) can access these tables
CREATE POLICY "Service role full access" ON public.orx_crawl_jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.orx_crawl_audit FOR ALL USING (true) WITH CHECK (true);
