-- تتبّع مصادر الحقول المهمة في الـdraft
ALTER TABLE IF EXISTS program_draft
  ADD COLUMN IF NOT EXISTS tuition_source_url text,
  ADD COLUMN IF NOT EXISTS admissions_source_url text;

-- جدول "جولة حصاد" country harvest (للتايم بوكس والتقارير)
CREATE TABLE IF NOT EXISTS harvest_jobs (
  id bigserial PRIMARY KEY,
  country text NOT NULL,
  locale text DEFAULT 'en',
  time_budget_min int DEFAULT 60,
  max_universities int DEFAULT 100,
  status text DEFAULT 'running',
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz,
  stats jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS harvest_results (
  id bigserial PRIMARY KEY,
  job_id bigint REFERENCES harvest_jobs(id) ON DELETE CASCADE,
  university_name text,
  domain text,
  has_official_fees boolean DEFAULT false,
  fee_urls text[],
  admissions_urls text[],
  confidence numeric,
  inserted_counts jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- فهارس للأداء
CREATE INDEX IF NOT EXISTS idx_harvest_jobs_status ON harvest_jobs(status);
CREATE INDEX IF NOT EXISTS idx_harvest_jobs_country ON harvest_jobs(country);
CREATE INDEX IF NOT EXISTS idx_harvest_results_job_id ON harvest_results(job_id);
CREATE INDEX IF NOT EXISTS idx_harvest_results_has_fees ON harvest_results(has_official_fees);

-- RLS
ALTER TABLE harvest_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE harvest_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS harvest_jobs_read ON harvest_jobs;
DROP POLICY IF EXISTS harvest_jobs_write ON harvest_jobs;
DROP POLICY IF EXISTS harvest_results_read ON harvest_results;
DROP POLICY IF EXISTS harvest_results_write ON harvest_results;

CREATE POLICY harvest_jobs_read ON harvest_jobs FOR SELECT USING (true);
CREATE POLICY harvest_jobs_write ON harvest_jobs FOR ALL USING (true);
CREATE POLICY harvest_results_read ON harvest_results FOR SELECT USING (true);
CREATE POLICY harvest_results_write ON harvest_results FOR ALL USING (true);