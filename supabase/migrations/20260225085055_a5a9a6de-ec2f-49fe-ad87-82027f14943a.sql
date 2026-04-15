
CREATE TABLE public.city_backfill_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id),
  university_name TEXT,
  country_code TEXT,
  old_city TEXT,
  proposed_city TEXT,
  confidence_score NUMERIC(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  source_method TEXT DEFAULT 'ai',
  reasoning JSONB,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','applied','rejected')),
  trace_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at TIMESTAMPTZ
);

CREATE INDEX idx_city_backfill_staging_uni ON public.city_backfill_staging(university_id);
CREATE INDEX idx_city_backfill_staging_status ON public.city_backfill_staging(status);
CREATE INDEX idx_city_backfill_staging_country ON public.city_backfill_staging(country_code);
CREATE INDEX idx_city_backfill_staging_trace ON public.city_backfill_staging(trace_id);

-- RLS: only service_role can write (edge functions), anon can read for admin dashboards
ALTER TABLE public.city_backfill_staging ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.city_backfill_staging
  FOR ALL USING (true) WITH CHECK (true);
