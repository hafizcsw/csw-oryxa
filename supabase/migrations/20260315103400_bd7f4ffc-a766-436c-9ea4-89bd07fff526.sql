
-- =============================================
-- ORX RANK Storage Contract — Patch 2
-- Normalized score table + history tracking
-- =============================================

-- 1. Entity type enum
CREATE TYPE public.orx_entity_type AS ENUM ('university', 'program', 'country');

-- 2. Status enum
CREATE TYPE public.orx_status AS ENUM ('scored', 'evaluating', 'insufficient');

-- 3. Badge enum
CREATE TYPE public.orx_badge AS ENUM (
  'future_ready',
  'high_future_relevance',
  'ai_era_ready',
  'strong_industry_link',
  'fast_adapter',
  'transparent'
);

-- 4. Main ORX scores table — one row per scored entity
CREATE TABLE public.orx_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type public.orx_entity_type NOT NULL,
  entity_id TEXT NOT NULL,
  status public.orx_status NOT NULL DEFAULT 'evaluating',
  score SMALLINT CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  rank_global INTEGER,
  rank_country INTEGER,
  confidence SMALLINT CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 100)),
  country_score SMALLINT CHECK (country_score IS NULL OR (country_score >= 0 AND country_score <= 100)),
  university_score SMALLINT CHECK (university_score IS NULL OR (university_score >= 0 AND university_score <= 100)),
  program_score SMALLINT CHECK (program_score IS NULL OR (program_score >= 0 AND program_score <= 100)),
  badges public.orx_badge[] DEFAULT '{}',
  summary TEXT,
  methodology_version TEXT DEFAULT '1.0',
  evaluated_at TIMESTAMPTZ,
  evidence_summary JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);

-- Index for fast lookups
CREATE INDEX idx_orx_scores_entity ON public.orx_scores (entity_type, entity_id);
CREATE INDEX idx_orx_scores_status ON public.orx_scores (status);
CREATE INDEX idx_orx_scores_rank_global ON public.orx_scores (rank_global) WHERE rank_global IS NOT NULL;

-- 5. History table — append-only log of every evaluation run
CREATE TABLE public.orx_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type public.orx_entity_type NOT NULL,
  entity_id TEXT NOT NULL,
  score SMALLINT,
  rank_global INTEGER,
  rank_country INTEGER,
  confidence SMALLINT,
  country_score SMALLINT,
  university_score SMALLINT,
  program_score SMALLINT,
  badges public.orx_badge[] DEFAULT '{}',
  methodology_version TEXT,
  evidence_summary JSONB DEFAULT '{}',
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orx_history_entity ON public.orx_score_history (entity_type, entity_id, evaluated_at DESC);

-- 6. RLS — public read, no anon write
ALTER TABLE public.orx_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orx_score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orx_scores_public_read" ON public.orx_scores
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "orx_history_public_read" ON public.orx_score_history
  FOR SELECT TO anon, authenticated USING (true);

-- 7. Auto-update updated_at
CREATE OR REPLACE FUNCTION public.orx_scores_update_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orx_scores_updated_at
  BEFORE UPDATE ON public.orx_scores
  FOR EACH ROW EXECUTE FUNCTION public.orx_scores_update_timestamp();
