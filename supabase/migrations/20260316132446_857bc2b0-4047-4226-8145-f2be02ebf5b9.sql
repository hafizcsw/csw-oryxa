
-- ══════════════════════════════════════════════════════════════
-- ORX 2.0 Dimension Facts — Normalized single table
-- Stores Living / Work & Mobility / ROI facts with governance metadata
-- Internal-only until explicit public promotion
-- ══════════════════════════════════════════════════════════════

-- Boundary type enum
CREATE TYPE public.orx_fact_boundary AS ENUM ('country', 'city', 'institution', 'program');

-- Dimension domain enum
CREATE TYPE public.orx_dimension_domain AS ENUM ('core', 'living', 'work_mobility', 'roi', 'fit');

-- Fact status enum (internal-first lifecycle)
CREATE TYPE public.orx_dimension_fact_status AS ENUM (
  'candidate',
  'internal_approved',
  'published',
  'rejected',
  'stale',
  'superseded'
);

-- Main facts table
CREATE TABLE public.orx_dimension_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Boundary & entity
  boundary_type orx_fact_boundary NOT NULL,
  entity_type TEXT NOT NULL,  -- 'university', 'program', 'country', 'city'
  entity_id TEXT NOT NULL,    -- UUID or slug depending on entity
  
  -- Dimension & classification
  dimension_domain orx_dimension_domain NOT NULL,
  fact_family TEXT NOT NULL,  -- e.g. 'housing_affordability', 'work_during_study_rights'
  fact_key TEXT NOT NULL,     -- specific key within family
  fact_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  display_text TEXT,
  
  -- Source provenance
  source_url TEXT,
  source_domain TEXT,
  source_family TEXT NOT NULL,  -- matches OrxSourceFamily
  source_type TEXT,             -- more specific type within family
  
  -- Governance metadata
  confidence SMALLINT,          -- 0-100
  coverage_score SMALLINT,      -- 0-100
  comparability_score SMALLINT, -- 0-100
  sparsity_flag BOOLEAN NOT NULL DEFAULT false,
  regional_bias_flag BOOLEAN NOT NULL DEFAULT false,
  freshness_date DATE,
  
  -- Lifecycle
  status orx_dimension_fact_status NOT NULL DEFAULT 'candidate',
  methodology_version TEXT NOT NULL DEFAULT 'v2.0',
  
  -- Timestamps
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Dedupe: same entity + family + key = same fact
  UNIQUE (entity_type, entity_id, dimension_domain, fact_family, fact_key)
);

-- Indexes for common query patterns
CREATE INDEX idx_orx_dim_facts_entity ON public.orx_dimension_facts (entity_type, entity_id);
CREATE INDEX idx_orx_dim_facts_domain ON public.orx_dimension_facts (dimension_domain, status);
CREATE INDEX idx_orx_dim_facts_boundary ON public.orx_dimension_facts (boundary_type, dimension_domain);
CREATE INDEX idx_orx_dim_facts_family ON public.orx_dimension_facts (fact_family);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.trg_orx_dim_facts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orx_dim_facts_updated_at
  BEFORE UPDATE ON public.orx_dimension_facts
  FOR EACH ROW EXECUTE FUNCTION public.trg_orx_dim_facts_updated_at();

-- RLS: public read for published only, service role for writes
ALTER TABLE public.orx_dimension_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published dimension facts"
  ON public.orx_dimension_facts
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "Service role full access to dimension facts"
  ON public.orx_dimension_facts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Internal view for admin/internal consumption (all statuses)
CREATE OR REPLACE VIEW public.vw_orx_dimension_facts_internal AS
SELECT * FROM public.orx_dimension_facts;

-- Published-only view for future public consumption
CREATE OR REPLACE VIEW public.vw_orx_dimension_facts_published AS
SELECT * FROM public.orx_dimension_facts
WHERE status = 'published';
