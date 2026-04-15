-- Create ingest_jobs table for university data ingestion pipeline
CREATE TABLE IF NOT EXISTS public.ingest_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file_path TEXT,
  source_file_sha256 TEXT,
  mime_type TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create ingest_artifacts table for storing extracted/parsed content
CREATE TABLE IF NOT EXISTS public.ingest_artifacts (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.ingest_jobs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  content JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create unis_assistant_events table for telemetry (if not exists)
CREATE TABLE IF NOT EXISTS public.unis_assistant_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id UUID,
  job_id UUID,
  context JSONB,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ingest_artifacts_job_id ON public.ingest_artifacts(job_id);
CREATE INDEX IF NOT EXISTS idx_ingest_artifacts_kind ON public.ingest_artifacts(kind);
CREATE INDEX IF NOT EXISTS idx_unis_assistant_events_job_id ON public.unis_assistant_events(job_id);
CREATE INDEX IF NOT EXISTS idx_unis_assistant_events_event_type ON public.unis_assistant_events(event_type);

-- Enable RLS (admin functions use service role, so policies not strictly needed)
ALTER TABLE public.ingest_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingest_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unis_assistant_events ENABLE ROW LEVEL SECURITY;

-- Create basic policies (service role bypasses these anyway)
CREATE POLICY "Admin full access to ingest_jobs" ON public.ingest_jobs
  FOR ALL USING (public.is_admin());

CREATE POLICY "Admin full access to ingest_artifacts" ON public.ingest_artifacts
  FOR ALL USING (public.is_admin());

CREATE POLICY "Admin full access to unis_assistant_events" ON public.unis_assistant_events
  FOR ALL USING (public.is_admin());