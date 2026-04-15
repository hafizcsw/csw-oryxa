-- Add structured data fields to ingestion_results
ALTER TABLE ingestion_results 
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS university_data JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS programs_data JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS scholarships_data JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS extraction_method TEXT DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS ai_model TEXT,
  ADD COLUMN IF NOT EXISTS validation_errors JSONB DEFAULT '[]'::jsonb;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_ingestion_results_confidence ON ingestion_results(confidence_score);
CREATE INDEX IF NOT EXISTS idx_ingestion_results_status ON ingestion_results(status);

-- Add source_type to ingestion_sources for categorization
ALTER TABLE ingestion_sources
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'university',
  ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS last_scraped_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS scrape_frequency TEXT DEFAULT 'monthly';

-- Create table for trusted sources templates
CREATE TABLE IF NOT EXISTS ingestion_source_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  url_pattern TEXT,
  extraction_rules JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert some trusted sources
INSERT INTO ingestion_source_templates (name, source_type, url_pattern) VALUES
  ('QS World Rankings', 'ranking', 'topuniversities.com'),
  ('Times Higher Education', 'ranking', 'timeshighereducation.com'),
  ('Scholarship.com', 'scholarship', 'scholarship.com'),
  ('StudyPortals', 'scholarship', 'studyportals.com')
ON CONFLICT DO NOTHING;