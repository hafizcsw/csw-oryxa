-- Trial-safe persistence for in-browser document intelligence engine.
-- Compact schema: 2 tables. Promoted state derived from proposal status.
-- Artifact/structured-artifact persisted as summary JSONB inside document_analyses.

-- ── document_analyses ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.document_analyses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  document_id text NOT NULL,
  document_filename text,
  slot_hint text,
  analysis_status text NOT NULL,
  parser_type text NOT NULL,
  classification_result text,
  classification_confidence numeric NOT NULL DEFAULT 0,
  readability_status text NOT NULL DEFAULT 'unknown',
  usefulness_status text NOT NULL DEFAULT 'unknown',
  duplicate_status text NOT NULL DEFAULT 'unknown',
  rejection_reason text,
  summary_message_internal text,
  extracted_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  field_confidence_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  artifact_summary jsonb,
  structured_artifact_summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_analyses_user_doc_unique UNIQUE (user_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_document_analyses_user ON public.document_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_document_analyses_user_doc ON public.document_analyses(user_id, document_id);

ALTER TABLE public.document_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own analyses"
  ON public.document_analyses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own analyses"
  ON public.document_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own analyses"
  ON public.document_analyses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own analyses"
  ON public.document_analyses FOR DELETE
  USING (auth.uid() = user_id);

-- ── extraction_proposals ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.extraction_proposals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  document_id text NOT NULL,
  proposal_id text NOT NULL,
  field_path text NOT NULL,
  proposed_value jsonb,
  raw_text text,
  confidence numeric NOT NULL DEFAULT 0,
  parser_source text NOT NULL,
  evidence_snippet text,
  source_lane text,
  status text NOT NULL,
  requires_review boolean NOT NULL DEFAULT true,
  auto_apply_candidate boolean NOT NULL DEFAULT false,
  rejection_reason text,
  conflict_with_existing jsonb,
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT extraction_proposals_user_proposal_unique UNIQUE (user_id, proposal_id)
);

CREATE INDEX IF NOT EXISTS idx_extraction_proposals_user ON public.extraction_proposals(user_id);
CREATE INDEX IF NOT EXISTS idx_extraction_proposals_user_doc ON public.extraction_proposals(user_id, document_id);
CREATE INDEX IF NOT EXISTS idx_extraction_proposals_user_status ON public.extraction_proposals(user_id, status);

ALTER TABLE public.extraction_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own proposals"
  ON public.extraction_proposals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own proposals"
  ON public.extraction_proposals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own proposals"
  ON public.extraction_proposals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own proposals"
  ON public.extraction_proposals FOR DELETE
  USING (auth.uid() = user_id);

-- ── timestamp trigger (reuse existing function if present) ───
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column' AND pronamespace = 'public'::regnamespace) THEN
    CREATE OR REPLACE FUNCTION public.update_updated_at_column()
    RETURNS TRIGGER AS $f$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $f$ LANGUAGE plpgsql SET search_path = public;
  END IF;
END$$;

DROP TRIGGER IF EXISTS trg_document_analyses_updated_at ON public.document_analyses;
CREATE TRIGGER trg_document_analyses_updated_at
  BEFORE UPDATE ON public.document_analyses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_extraction_proposals_updated_at ON public.extraction_proposals;
CREATE TRIGGER trg_extraction_proposals_updated_at
  BEFORE UPDATE ON public.extraction_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();