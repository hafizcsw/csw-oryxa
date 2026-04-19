-- ═══════════════════════════════════════════════════════════════
-- Door 3 Semantic Layer — narrow migration
-- ═══════════════════════════════════════════════════════════════
-- 1) Add new job type to existing enum (matches schema convention)
ALTER TYPE public.door3_job_type ADD VALUE IF NOT EXISTS 'ai_semantic_parse';

-- 2) Audit table for the semantic layer (one row per (document, evidence_version))
CREATE TABLE IF NOT EXISTS public.document_semantic_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL,
  user_id UUID NOT NULL,
  evidence_version TEXT NOT NULL,
  lane TEXT NOT NULL,
  model TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  outcome TEXT NOT NULL, -- 'parsed' | 'ocr_evidence_insufficient' | 'parse_failed' | 'validator_rejected' | 'qwen_unconfigured' | 'qwen_unreachable'
  raw_ai_output JSONB,
  validated_facts JSONB,
  notes TEXT[] DEFAULT ARRAY[]::TEXT[],
  reason TEXT,
  processing_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS document_semantic_runs_doc_evidence_unique
  ON public.document_semantic_runs (document_id, evidence_version);

CREATE INDEX IF NOT EXISTS document_semantic_runs_user_idx
  ON public.document_semantic_runs (user_id, created_at DESC);

-- 3) RLS — per-user select; service role handles writes
ALTER TABLE public.document_semantic_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own semantic runs"
  ON public.document_semantic_runs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role bypasses RLS automatically; no explicit insert/update policy
-- needed because edge functions use service-role key.