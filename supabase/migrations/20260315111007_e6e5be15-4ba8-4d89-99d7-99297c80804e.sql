
-- ORX Evidence Registry — Patch 5
-- Normalized evidence storage for ORX scoring pipeline

-- 1. Enums

CREATE TYPE public.orx_evidence_status AS ENUM (
  'discovered',
  'fetched',
  'extracted',
  'normalized',
  'accepted',
  'rejected',
  'stale',
  'superseded',
  'conflicted'
);

CREATE TYPE public.orx_trust_level AS ENUM (
  'high',
  'medium',
  'low'
);

CREATE TYPE public.orx_source_type AS ENUM (
  'official_website',
  'course_catalog',
  'official_pdf',
  'structured_data',
  'government_report',
  'accreditation_body',
  'verified_student',
  'third_party_index',
  'news_press'
);

-- 2. Evidence table

CREATE TABLE public.orx_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Entity binding
  entity_type public.orx_entity_type NOT NULL,
  entity_id TEXT NOT NULL,
  layer TEXT NOT NULL CHECK (layer IN ('country', 'university', 'program')),
  signal_family TEXT NOT NULL,

  -- Source identity
  source_type public.orx_source_type NOT NULL,
  source_url TEXT NOT NULL,
  source_domain TEXT NOT NULL,
  source_title TEXT,
  trust_level public.orx_trust_level NOT NULL DEFAULT 'low',
  contextual_only BOOLEAN NOT NULL DEFAULT false,

  -- Content
  snippet TEXT,
  language_code TEXT DEFAULT 'en',
  content_hash TEXT NOT NULL,

  -- Temporal
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  freshness_date DATE,

  -- Pipeline state
  evidence_status public.orx_evidence_status NOT NULL DEFAULT 'discovered',
  extraction_confidence SMALLINT CHECK (extraction_confidence BETWEEN 0 AND 100),
  rejection_reason TEXT,

  -- Conflict / dedupe
  conflict_group_id UUID,

  -- Versioning
  methodology_version TEXT NOT NULL DEFAULT '1.1',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Indexes

-- Dedupe: same entity + same content = duplicate
CREATE UNIQUE INDEX uq_orx_evidence_entity_hash
  ON public.orx_evidence (entity_type, entity_id, content_hash)
  WHERE evidence_status NOT IN ('rejected', 'superseded');

-- Fast lookups by entity
CREATE INDEX idx_orx_evidence_entity
  ON public.orx_evidence (entity_type, entity_id);

-- Source independence queries: group by domain per entity
CREATE INDEX idx_orx_evidence_domain
  ON public.orx_evidence (entity_type, entity_id, source_domain);

-- Signal family coverage queries
CREATE INDEX idx_orx_evidence_signal
  ON public.orx_evidence (entity_type, entity_id, signal_family);

-- Pipeline state filtering
CREATE INDEX idx_orx_evidence_status
  ON public.orx_evidence (evidence_status);

-- Conflict group lookups
CREATE INDEX idx_orx_evidence_conflict
  ON public.orx_evidence (conflict_group_id)
  WHERE conflict_group_id IS NOT NULL;

-- 4. RLS — public read, no anon write

ALTER TABLE public.orx_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orx_evidence_public_read"
  ON public.orx_evidence
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 5. Updated_at trigger

CREATE TRIGGER trg_orx_evidence_updated_at
  BEFORE UPDATE ON public.orx_evidence
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
