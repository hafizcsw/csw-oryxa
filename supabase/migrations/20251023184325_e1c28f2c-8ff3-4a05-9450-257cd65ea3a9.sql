-- Patch 17 (Fixed): Admissions Studio + Programs Bulk Actions

-- 1. Add published column to programs (non-destructive)
ALTER TABLE programs 
ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_programs_published ON programs(published);

-- 2. Create admissions_observations table (without foreign key to source_registry)
CREATE TABLE IF NOT EXISTS admissions_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  degree_level TEXT,
  audience TEXT DEFAULT 'international',
  
  -- Requirements data
  min_gpa NUMERIC,
  min_ielts NUMERIC,
  min_toefl INTEGER,
  other_requirements JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  source_id UUID, -- No FK constraint
  source_url TEXT,
  observed_at TIMESTAMPTZ DEFAULT now(),
  confidence NUMERIC DEFAULT 0.5 CHECK (confidence BETWEEN 0 AND 1),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admissions_obs_uni ON admissions_observations(university_id);
CREATE INDEX IF NOT EXISTS idx_admissions_obs_prog ON admissions_observations(program_id);

-- 3. Create admissions_consensus table
CREATE TABLE IF NOT EXISTS admissions_consensus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  degree_level TEXT,
  audience TEXT DEFAULT 'international',
  
  -- Consensus requirements
  consensus_min_gpa NUMERIC,
  consensus_min_ielts NUMERIC,
  consensus_min_toefl INTEGER,
  consensus_other_requirements JSONB DEFAULT '[]'::jsonb,
  
  -- Confidence metrics
  confidence_score NUMERIC DEFAULT 0 CHECK (confidence_score BETWEEN 0 AND 1),
  observations_count INTEGER DEFAULT 0,
  
  -- Staleness tracking
  is_stale BOOLEAN DEFAULT false,
  last_updated_at TIMESTAMPTZ DEFAULT now(),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(university_id, program_id, degree_level, audience)
);

CREATE INDEX IF NOT EXISTS idx_admissions_consensus_uni ON admissions_consensus(university_id);
CREATE INDEX IF NOT EXISTS idx_admissions_consensus_stale ON admissions_consensus(is_stale);

-- 4. Create public view for admissions
CREATE OR REPLACE VIEW vw_admissions_public AS
SELECT 
  ac.university_id,
  ac.program_id,
  ac.degree_level,
  ac.audience,
  ac.consensus_min_gpa,
  ac.consensus_min_ielts,
  ac.consensus_min_toefl,
  ac.consensus_other_requirements,
  ac.confidence_score,
  ac.last_updated_at
FROM admissions_consensus ac
WHERE ac.is_stale = false
  AND ac.confidence_score >= 0.6;

-- 5. Enable RLS on new tables
ALTER TABLE admissions_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE admissions_consensus ENABLE ROW LEVEL SECURITY;

-- Admin-only access policies
CREATE POLICY "admin_admissions_obs_all" ON admissions_observations
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "admin_admissions_consensus_all" ON admissions_consensus
  FOR ALL USING (is_admin(auth.uid()));