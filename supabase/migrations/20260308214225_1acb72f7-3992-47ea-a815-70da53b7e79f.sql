
-- ============================================================
-- Phase 1: Global Localization Foundation (ADDITIVE ONLY)
-- Does NOT modify any existing tables or columns.
-- ============================================================

-- 1. entity_translations — Centralized Translation Store
CREATE TABLE public.entity_translations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     text NOT NULL,
  entity_id       text NOT NULL,
  field_name      text NOT NULL,
  locale          text NOT NULL,
  translated_text text NOT NULL,
  source_hash     text,
  translation_source text NOT NULL DEFAULT 'manual',
  quality_tier    smallint NOT NULL DEFAULT 2,
  review_status   text NOT NULL DEFAULT 'pending',
  reviewed_by     uuid,
  reviewed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_entity_translation UNIQUE (entity_type, entity_id, field_name, locale)
);

CREATE INDEX idx_et_entity_lookup ON public.entity_translations (entity_type, entity_id, locale);
CREATE INDEX idx_et_stale ON public.entity_translations (review_status) WHERE review_status = 'stale';
CREATE INDEX idx_et_quality ON public.entity_translations (quality_tier, locale);

CREATE TRIGGER trg_et_updated_at
  BEFORE UPDATE ON public.entity_translations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.entity_translations ENABLE ROW LEVEL SECURITY;

-- NOT public-readable: only authenticated admin via API/RPC
CREATE POLICY "Admin read translations"
  ON public.entity_translations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin write translations"
  ON public.entity_translations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Service role full access (for edge functions / resolver)
CREATE POLICY "Service role full access on entity_translations"
  ON public.entity_translations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- 2. translation_glossary — Domain Terminology
CREATE TABLE public.translation_glossary (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term_key        text NOT NULL,
  source_locale   text NOT NULL DEFAULT 'en',
  source_text     text NOT NULL,
  target_locale   text NOT NULL,
  target_text     text NOT NULL,
  domain          text NOT NULL DEFAULT 'higher_education',
  term_type       text NOT NULL DEFAULT 'term',
  preserve_rule   text DEFAULT 'translate',
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_glossary_term UNIQUE (term_key, source_locale, target_locale)
);

CREATE INDEX idx_glossary_lookup ON public.translation_glossary (source_locale, target_locale, domain);

CREATE TRIGGER trg_glossary_updated_at
  BEFORE UPDATE ON public.translation_glossary
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.translation_glossary ENABLE ROW LEVEL SECURITY;

-- Not public readable
CREATE POLICY "Admin read glossary"
  ON public.translation_glossary FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin write glossary"
  ON public.translation_glossary FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access on glossary"
  ON public.translation_glossary FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- 3. translation_jobs_v2 — Async Translation Pipeline
CREATE TABLE public.translation_jobs_v2 (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     text NOT NULL,
  entity_id       text NOT NULL,
  field_name      text NOT NULL,
  source_locale   text NOT NULL DEFAULT 'en',
  target_locale   text NOT NULL,
  source_text     text NOT NULL,
  source_hash     text NOT NULL,
  priority        smallint NOT NULL DEFAULT 5,
  status          text NOT NULL DEFAULT 'pending',
  attempts        smallint NOT NULL DEFAULT 0,
  max_attempts    smallint NOT NULL DEFAULT 3,
  glossary_applied boolean NOT NULL DEFAULT false,
  model_used      text,
  translated_text text,
  error_message   text,
  claimed_at      timestamptz,
  processed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_job_dedup UNIQUE (entity_type, entity_id, field_name, target_locale, source_hash)
);

CREATE INDEX idx_tj2_pending ON public.translation_jobs_v2 (status, priority, created_at)
  WHERE status IN ('pending', 'claimed');
CREATE INDEX idx_tj2_entity ON public.translation_jobs_v2 (entity_type, entity_id);

ALTER TABLE public.translation_jobs_v2 ENABLE ROW LEVEL SECURITY;

-- Only service role (edge functions)
CREATE POLICY "Service role only on translation_jobs_v2"
  ON public.translation_jobs_v2 FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
