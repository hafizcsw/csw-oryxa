
-- ═══════════════════════════════════════════════════════════
-- ORX Beta Launch Gate + Entity Enrichment Facts
-- ═══════════════════════════════════════════════════════════

-- 1) Exposure status enum
CREATE TYPE public.orx_exposure_status AS ENUM (
  'internal_only',
  'beta_candidate',
  'beta_approved',
  'blocked_low_confidence',
  'blocked_missing_layer',
  'blocked_uncalibrated',
  'blocked_external_source_issue'
);

-- 2) Add beta gate columns to orx_scores
ALTER TABLE public.orx_scores
  ADD COLUMN IF NOT EXISTS exposure_status public.orx_exposure_status NOT NULL DEFAULT 'internal_only',
  ADD COLUMN IF NOT EXISTS calibration_reviewed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS calibration_passed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS beta_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS beta_approved_by text;

CREATE INDEX IF NOT EXISTS idx_orx_scores_exposure ON public.orx_scores (exposure_status);

-- 3) Enrichment fact status enum
CREATE TYPE public.enrichment_fact_status AS ENUM (
  'candidate',
  'approved',
  'published',
  'rejected',
  'stale',
  'superseded'
);

-- 4) Entity enrichment facts table
CREATE TABLE public.entity_enrichment_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type public.orx_entity_type NOT NULL,
  entity_id uuid NOT NULL,
  fact_type text NOT NULL,
  fact_key text NOT NULL,
  fact_value jsonb NOT NULL DEFAULT '{}',
  display_text text,
  source_url text,
  source_domain text,
  source_type text,
  confidence numeric,
  status public.enrichment_fact_status NOT NULL DEFAULT 'candidate',
  evidence_id uuid,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, fact_type, fact_key, source_domain)
);

CREATE INDEX idx_enrichment_facts_entity ON public.entity_enrichment_facts (entity_type, entity_id);
CREATE INDEX idx_enrichment_facts_status ON public.entity_enrichment_facts (status);
CREATE INDEX idx_enrichment_facts_type ON public.entity_enrichment_facts (fact_type);

-- 5) RLS: public read, no anon write
ALTER TABLE public.entity_enrichment_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enrichment_facts_public_read" ON public.entity_enrichment_facts
  FOR SELECT TO anon, authenticated USING (true);

-- 6) Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION public.enrichment_facts_update_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_enrichment_facts_updated_at
  BEFORE UPDATE ON public.entity_enrichment_facts
  FOR EACH ROW EXECUTE FUNCTION public.enrichment_facts_update_timestamp();

-- 7) Display-ready view for published facts
CREATE OR REPLACE VIEW public.vw_entity_enrichment_published AS
SELECT
  id,
  entity_type,
  entity_id,
  fact_type,
  fact_key,
  fact_value,
  display_text,
  source_url,
  source_domain,
  source_type,
  confidence,
  last_verified_at,
  first_seen_at
FROM public.entity_enrichment_facts
WHERE status = 'published';
