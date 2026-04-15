-- ============================================================
-- INSTITUTION RANKINGS TABLE - Catalog SoT for Rank10 Filters
-- ============================================================

CREATE TABLE public.institution_rankings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  
  -- Ranking System & Year
  ranking_system TEXT NOT NULL CHECK (ranking_system IN ('qs', 'the', 'arwu', 'usnews', 'cwur')),
  ranking_year INTEGER NOT NULL CHECK (ranking_year >= 2000 AND ranking_year <= 2100),
  
  -- Rank Limits
  world_rank INTEGER CHECK (world_rank >= 1),
  national_rank INTEGER CHECK (national_rank >= 1),
  
  -- Score Thresholds (0..100)
  overall_score NUMERIC(5,2) CHECK (overall_score >= 0 AND overall_score <= 100),
  teaching_score NUMERIC(5,2) CHECK (teaching_score >= 0 AND teaching_score <= 100),
  employability_score NUMERIC(5,2) CHECK (employability_score >= 0 AND employability_score <= 100),
  academic_reputation_score NUMERIC(5,2) CHECK (academic_reputation_score >= 0 AND academic_reputation_score <= 100),
  research_score NUMERIC(5,2) CHECK (research_score >= 0 AND research_score <= 100),
  
  -- Metadata
  source_url TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_institution_ranking UNIQUE (institution_id, ranking_system, ranking_year)
);

-- Enable RLS
ALTER TABLE public.institution_rankings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Institution rankings are publicly readable"
ON public.institution_rankings FOR SELECT USING (true);

CREATE POLICY "Admins can insert institution rankings"
ON public.institution_rankings FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins can update institution rankings"
ON public.institution_rankings FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins can delete institution rankings"
ON public.institution_rankings FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_institution_rankings_updated_at
BEFORE UPDATE ON public.institution_rankings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_institution_rankings_institution ON public.institution_rankings(institution_id);
CREATE INDEX idx_institution_rankings_system_year ON public.institution_rankings(ranking_system, ranking_year);
CREATE INDEX idx_institution_rankings_world_rank ON public.institution_rankings(world_rank) WHERE world_rank IS NOT NULL;
CREATE INDEX idx_institution_rankings_primary ON public.institution_rankings(institution_id) WHERE is_primary = true;

COMMENT ON TABLE public.institution_rankings IS 'Institution rankings data source for RANK10 filter keys.';