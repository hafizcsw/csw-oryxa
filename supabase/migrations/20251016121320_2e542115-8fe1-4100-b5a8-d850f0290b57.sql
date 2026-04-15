-- Create ingestion tables for University Bot
CREATE TABLE IF NOT EXISTS ingestion_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  title text NOT NULL,
  url text NOT NULL,
  enabled boolean DEFAULT true,
  notes text
);

CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  source_id uuid REFERENCES ingestion_sources(id) ON DELETE CASCADE,
  status text CHECK (status IN ('pending','running','done','error')) DEFAULT 'pending',
  attempts int DEFAULT 0,
  next_attempt_at timestamptz DEFAULT now(),
  last_error text
);

CREATE INDEX IF NOT EXISTS idx_ing_jobs_status_next
  ON ingestion_jobs(status, next_attempt_at);

CREATE TABLE IF NOT EXISTS ingestion_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  job_id uuid REFERENCES ingestion_jobs(id) ON DELETE CASCADE,
  raw jsonb,
  mapped jsonb,
  status text CHECK (status IN ('draft','approved','rejected')) DEFAULT 'draft',
  reviewer text,
  reviewed_at timestamptz
);

-- RLS policies for admin access
ALTER TABLE ingestion_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage ingestion sources"
  ON ingestion_sources FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admin can manage ingestion jobs"
  ON ingestion_jobs FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admin can manage ingestion results"
  ON ingestion_results FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));