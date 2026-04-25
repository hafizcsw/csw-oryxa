-- ═══════════════════════════════════════════════════════════════
-- Order 3R.1 — CSW-controlled OCR pre-processing logging
-- ═══════════════════════════════════════════════════════════════

-- 1) Per-OCR-run audit log (separate from oryxa_ai_runs which logs DeepSeek)
CREATE TABLE IF NOT EXISTS public.oryxa_ocr_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID NOT NULL,
  draft_id UUID REFERENCES public.portal_document_drafts(id) ON DELETE CASCADE,
  -- Strategy summary: 'pdf_text', 'paddle_structure', 'mixed', 'failed'
  engine_path TEXT NOT NULL,
  -- Per-page methods array (e.g. ['pdf_text','paddle_structure'])
  page_methods JSONB NOT NULL DEFAULT '[]'::jsonb,
  pages_total INTEGER,
  chars_total INTEGER,
  avg_confidence NUMERIC,
  quality_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL,                      -- 'ok' | 'failed' | 'no_endpoint_configured' | 'unreadable_document'
  error TEXT,
  latency_ms INTEGER,
  trace_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS oryxa_ocr_runs_student_idx
  ON public.oryxa_ocr_runs(student_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS oryxa_ocr_runs_draft_idx
  ON public.oryxa_ocr_runs(draft_id);

ALTER TABLE public.oryxa_ocr_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ocr_runs_owner_select" ON public.oryxa_ocr_runs;
CREATE POLICY "ocr_runs_owner_select"
  ON public.oryxa_ocr_runs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = student_user_id);

-- writes happen via edge function (service role bypasses RLS); no insert policy for clients

-- 2) Tiny extension to extractions table to surface which OCR engine fed DeepSeek
ALTER TABLE public.portal_document_draft_extractions
  ADD COLUMN IF NOT EXISTS ocr_engine_path TEXT,
  ADD COLUMN IF NOT EXISTS ocr_quality_flags JSONB NOT NULL DEFAULT '[]'::jsonb;