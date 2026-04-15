-- Create harvest system tables with correct schema

-- Drop existing tables if they have wrong schema
DROP TABLE IF EXISTS harvest_logs CASCADE;
DROP TABLE IF EXISTS harvest_runs CASCADE;
DROP TABLE IF EXISTS harvest_jobs CASCADE;

-- 1. harvest_jobs table
CREATE TABLE harvest_jobs (
  id bigserial PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('fees', 'admissions', 'media', 'scholarships', 'full')),
  country_code text,
  audience text DEFAULT 'international',
  degree_level text,
  university_id uuid,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  created_by text,
  scheduled_for timestamp with time zone,
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- 2. harvest_runs table
CREATE TABLE harvest_runs (
  id bigserial PRIMARY KEY,
  job_id bigint REFERENCES harvest_jobs(id) ON DELETE CASCADE,
  state text DEFAULT 'running' CHECK (state IN ('running', 'done', 'error')),
  processed int DEFAULT 0,
  changed int DEFAULT 0,
  nochange int DEFAULT 0,
  errors int DEFAULT 0,
  started_at timestamp with time zone DEFAULT now(),
  finished_at timestamp with time zone
);

-- 3. harvest_logs table
CREATE TABLE harvest_logs (
  id bigserial PRIMARY KEY,
  run_id bigint REFERENCES harvest_runs(id) ON DELETE CASCADE,
  level text DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error')),
  message text NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_harvest_jobs_status ON harvest_jobs(status);
CREATE INDEX idx_harvest_jobs_created ON harvest_jobs(created_at DESC);
CREATE INDEX idx_harvest_runs_job ON harvest_runs(job_id);
CREATE INDEX idx_harvest_logs_run ON harvest_logs(run_id);

-- Enable RLS
ALTER TABLE harvest_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE harvest_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE harvest_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for admin access
CREATE POLICY harvest_jobs_admin_all ON harvest_jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY harvest_runs_admin_all ON harvest_runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY harvest_logs_admin_all ON harvest_logs FOR ALL USING (true) WITH CHECK (true);