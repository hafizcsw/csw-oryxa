-- ═══════════════════════════════════════════════════════════════
-- Door 2 — Fast Value Gate: unified lane facts table
-- ═══════════════════════════════════════════════════════════════
-- Stores canonical extracted facts per document for any lane
-- (passport_lane, graduation_lane, language_lane).
-- One row per document_id (upsert). RLS: owner-only.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.document_lane_facts (
  document_id UUID NOT NULL PRIMARY KEY,
  user_id UUID NOT NULL,
  lane TEXT NOT NULL,
  -- Truth state per the foundation truth model
  truth_state TEXT NOT NULL DEFAULT 'extracted',
  -- Overall lane confidence 0..1
  lane_confidence NUMERIC(4,3) NOT NULL DEFAULT 0,
  -- True if any required field is missing or low-confidence
  requires_review BOOLEAN NOT NULL DEFAULT true,
  -- Canonical facts: { field_name: { value, confidence, source, status } }
  facts JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Engine metadata: producer, processing_ms, ocr_used, etc.
  engine_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Free-form audit notes
  notes TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_document_lane_facts_user
  ON public.document_lane_facts (user_id);
CREATE INDEX IF NOT EXISTS idx_document_lane_facts_lane
  ON public.document_lane_facts (lane);
CREATE INDEX IF NOT EXISTS idx_document_lane_facts_review
  ON public.document_lane_facts (user_id, requires_review)
  WHERE requires_review = true;

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.document_lane_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own lane facts"
  ON public.document_lane_facts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own lane facts"
  ON public.document_lane_facts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own lane facts"
  ON public.document_lane_facts
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own lane facts"
  ON public.document_lane_facts
  FOR DELETE
  USING (auth.uid() = user_id);

-- ── updated_at trigger ───────────────────────────────────────
CREATE TRIGGER trg_document_lane_facts_updated
  BEFORE UPDATE ON public.document_lane_facts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();