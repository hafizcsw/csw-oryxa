-- Create source_evidence table for tracking data sources
CREATE TABLE IF NOT EXISTS source_evidence (
  id bigserial PRIMARY KEY,
  program_id uuid REFERENCES programs(id) ON DELETE CASCADE,
  field text CHECK (field IN ('tuition_fee','requirements','deadline','scholarship','currency','duration')),
  source_url text NOT NULL,
  captured_at timestamptz DEFAULT now(),
  text_snippet text,
  selector text,
  content_hash text,
  academic_year text,
  country_code text,
  page_lang text,
  confidence numeric
);

-- Enable RLS
ALTER TABLE source_evidence ENABLE ROW LEVEL SECURITY;

-- Admin access policy
CREATE POLICY src_evd_admin ON source_evidence FOR ALL
  USING (is_admin(auth.uid())) 
  WITH CHECK (is_admin(auth.uid()));

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_source_evidence_program_id ON source_evidence(program_id);
CREATE INDEX IF NOT EXISTS idx_source_evidence_field ON source_evidence(field);
CREATE INDEX IF NOT EXISTS idx_source_evidence_country ON source_evidence(country_code) WHERE country_code IS NOT NULL;