-- SEO Operations Tables

-- 1) Google Search Console daily data
CREATE TABLE IF NOT EXISTS seo_gsc_daily(
  id bigserial primary key,
  date date not null,
  page text not null,
  country_slug text,
  clicks int default 0,
  impressions int default 0,
  ctr numeric(5,2),
  position numeric(5,2),
  created_at timestamptz default now()
);
CREATE INDEX IF NOT EXISTS ix_gsc_date_page ON seo_gsc_daily(date, page);

-- 2) Crawl snapshots for indexability
CREATE TABLE IF NOT EXISTS seo_crawl_snapshots(
  id bigserial primary key,
  page text not null,
  status int,
  ttfb_ms int,
  has_title bool,
  has_meta_desc bool,
  has_h1 bool,
  canonical text,
  noindex bool,
  checked_at timestamptz default now()
);
CREATE INDEX IF NOT EXISTS ix_crawl_checked_at ON seo_crawl_snapshots(checked_at);

-- 3) SEO jobs queue
CREATE TABLE IF NOT EXISTS seo_jobs(
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  scope text,
  scheduled_at timestamptz default now(),
  created_by uuid,
  status text default 'queued'
);

-- 4) Job execution history
CREATE TABLE IF NOT EXISTS seo_job_runs(
  id bigserial primary key,
  job_id uuid references seo_jobs(id),
  started_at timestamptz default now(),
  finished_at timestamptz,
  ok bool,
  stats jsonb,
  error text
);

-- 5) SEO scores per country/locale
CREATE TABLE IF NOT EXISTS seo_scores(
  id bigserial primary key,
  country_slug text not null,
  locale text not null,
  score numeric(5,2) default 0,
  coverage numeric(5,2) default 0,
  ctr_change numeric(5,2) default 0,
  cwv_score numeric(5,2) default 0,
  content_freshness numeric(5,2) default 0,
  index_speed numeric(5,2) default 0,
  calculated_at timestamptz default now(),
  UNIQUE(country_slug, locale)
);

-- Enable RLS
ALTER TABLE seo_gsc_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_crawl_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_scores ENABLE ROW LEVEL SECURITY;

-- Admin read policies
CREATE POLICY "Admins can view GSC data" ON seo_gsc_daily FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Admins can view crawl snapshots" ON seo_crawl_snapshots FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Admins can view SEO jobs" ON seo_jobs FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Admins can view job runs" ON seo_job_runs FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Admins can view SEO scores" ON seo_scores FOR SELECT USING (is_admin(auth.uid()));

-- Admin write policies
CREATE POLICY "Admins can create SEO jobs" ON seo_jobs FOR INSERT WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can update SEO jobs" ON seo_jobs FOR UPDATE USING (is_admin(auth.uid()));