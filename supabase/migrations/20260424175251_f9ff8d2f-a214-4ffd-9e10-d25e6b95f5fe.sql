-- ═══════════════════════════════════════════════════════════════
-- Order 3 — Extraction from Portal Drafts
-- Draft-scoped extraction surface. NO CRM tables touched.
-- ═══════════════════════════════════════════════════════════════

-- 1) Add extraction tracking columns to portal_document_drafts
--    (extraction_status already exists from Order 2 migration; add metadata)
ALTER TABLE public.portal_document_drafts
  ADD COLUMN IF NOT EXISTS extraction_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS extraction_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS extraction_trace_id TEXT,
  ADD COLUMN IF NOT EXISTS extraction_error TEXT;

-- 2) Draft-scoped extraction results table
CREATE TABLE IF NOT EXISTS public.portal_document_draft_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES public.portal_document_drafts(id) ON DELETE CASCADE,
  student_user_id UUID NOT NULL,
  family TEXT,
  family_confidence NUMERIC,
  is_recognized BOOLEAN NOT NULL DEFAULT false,
  rejection_reason TEXT,
  truth_state TEXT,
  lane_confidence NUMERIC,
  facts JSONB NOT NULL DEFAULT '{}'::jsonb,
  ocr_pages INTEGER,
  ocr_chars INTEGER,
  engine_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  trace_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS portal_document_draft_extractions_draft_id_uniq
  ON public.portal_document_draft_extractions(draft_id);

CREATE INDEX IF NOT EXISTS portal_document_draft_extractions_student_idx
  ON public.portal_document_draft_extractions(student_user_id);

ALTER TABLE public.portal_document_draft_extractions ENABLE ROW LEVEL SECURITY;

-- RLS: only the owning student can read; writes only from edge function (service role bypasses RLS)
CREATE POLICY "Students can view own draft extractions"
  ON public.portal_document_draft_extractions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = student_user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_portal_draft_extraction_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_portal_draft_extraction_updated_at
  ON public.portal_document_draft_extractions;
CREATE TRIGGER trg_portal_draft_extraction_updated_at
  BEFORE UPDATE ON public.portal_document_draft_extractions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_portal_draft_extraction_updated_at();
