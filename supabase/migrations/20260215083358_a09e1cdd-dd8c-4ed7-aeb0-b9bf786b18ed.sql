
-- ============================================================
-- GO-LIVE PACK Migration: A + B + C + D Infrastructure
-- ============================================================

-- ============ A1: University Identity Keys ============

CREATE UNIQUE INDEX IF NOT EXISTS uq_universities_cwur_profile_url 
  ON public.universities (cwur_profile_url) WHERE cwur_profile_url IS NOT NULL;

ALTER TABLE public.universities 
  ADD COLUMN IF NOT EXISTS website_host TEXT 
  GENERATED ALWAYS AS (
    CASE WHEN website IS NOT NULL THEN
      lower(regexp_replace(regexp_replace(website, '^https?://', '', 'i'), '^www\.', '', 'i'))
    ELSE NULL END
  ) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS uq_universities_website_host 
  ON public.universities (website_host) WHERE website_host IS NOT NULL;

-- ============ B2: host_key on program_urls ============

ALTER TABLE public.program_urls 
  ADD COLUMN IF NOT EXISTS host_key TEXT 
  GENERATED ALWAYS AS (
    CASE WHEN canonical_url IS NOT NULL THEN
      lower(regexp_replace(regexp_replace(
        (regexp_match(canonical_url, '^https?://([^/]+)'))[1],
        '^www\.', '', 'i'), ':\d+$', '', 'g'))
    WHEN url IS NOT NULL THEN
      lower(regexp_replace(regexp_replace(
        (regexp_match(url, '^https?://([^/]+)'))[1],
        '^www\.', '', 'i'), ':\d+$', '', 'g'))
    ELSE NULL END
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_program_urls_host_key 
  ON public.program_urls (host_key) WHERE host_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_program_urls_inflight_host 
  ON public.program_urls (host_key, status) 
  WHERE status IN ('fetching', 'extracting');

-- ============ C2: Kill Switch ============

CREATE TABLE IF NOT EXISTS public.crawl_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);

ALTER TABLE public.crawl_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on crawl_settings" ON public.crawl_settings
  FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.crawl_settings (key, value) VALUES 
  ('is_paused', '{"paused": false}'::jsonb),
  ('shard_config', '{"shard_count": 10, "active_shards": [0,1,2,3,4,5,6,7,8,9]}'::jsonb),
  ('throttle_defaults', '{"max_concurrency_per_host": 1, "delay_ms": 2000, "backoff_429_ms": 30000}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============ D1: crawl_domain_policies enhancements ============

ALTER TABLE public.crawl_domain_policies 
  ADD COLUMN IF NOT EXISTS max_concurrency INT NOT NULL DEFAULT 1;

ALTER TABLE public.crawl_domain_policies 
  ADD COLUMN IF NOT EXISTS backoff_429_ms INT NOT NULL DEFAULT 30000;

ALTER TABLE public.crawl_domain_policies 
  ADD COLUMN IF NOT EXISTS last_429_at TIMESTAMPTZ;

ALTER TABLE public.crawl_domain_policies 
  ADD COLUMN IF NOT EXISTS robots_txt_cache TEXT;

ALTER TABLE public.crawl_domain_policies 
  ADD COLUMN IF NOT EXISTS robots_fetched_at TIMESTAMPTZ;

-- ============ D2: Off-domain guard ============

CREATE OR REPLACE FUNCTION public.rpc_check_off_domain_urls()
RETURNS TABLE(off_domain_count BIGINT) 
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*) AS off_domain_count
  FROM program_urls pu
  JOIN universities u ON u.id = pu.university_id
  WHERE pu.status IN ('pending','fetching','fetched','retry')
    AND u.website IS NOT NULL
    AND pu.host_key IS NOT NULL
    AND u.website_host IS NOT NULL
    AND pu.host_key != u.website_host;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_check_off_domain_urls() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_check_off_domain_urls() TO service_role;

-- ============ F: Observability — add metric column to existing table ============

ALTER TABLE public.pipeline_health_events 
  ADD COLUMN IF NOT EXISTS metric TEXT;

ALTER TABLE public.pipeline_health_events 
  ADD COLUMN IF NOT EXISTS value NUMERIC;

ALTER TABLE public.pipeline_health_events 
  ADD COLUMN IF NOT EXISTS shard_id INT;

ALTER TABLE public.pipeline_health_events 
  ADD COLUMN IF NOT EXISTS window_start TIMESTAMPTZ;

ALTER TABLE public.pipeline_health_events 
  ADD COLUMN IF NOT EXISTS window_end TIMESTAMPTZ;

ALTER TABLE public.pipeline_health_events 
  ADD COLUMN IF NOT EXISTS details JSONB;

CREATE INDEX IF NOT EXISTS idx_pipeline_health_metric 
  ON public.pipeline_health_events (metric, created_at DESC) WHERE metric IS NOT NULL;
