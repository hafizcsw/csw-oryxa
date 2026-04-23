-- ============================================================
-- Phase A: Source-Side Normalization Engine
-- 6 core tables (4 reference tables live as local TS packs)
-- ============================================================

-- 1) document_extraction_raw — raw OCR/extraction output
CREATE TABLE public.document_extraction_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id uuid NOT NULL,
  source_document_id text,
  source_country_code text,
  extractor_name text NOT NULL,
  extractor_version text,
  raw_payload jsonb NOT NULL,
  trace_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2) document_extraction_canonical — canonicalized fields
CREATE TABLE public.document_extraction_canonical (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_extraction_id uuid NOT NULL REFERENCES public.document_extraction_raw(id) ON DELETE CASCADE,
  student_user_id uuid NOT NULL,
  source_country_code text,
  canonical_fields jsonb NOT NULL,
  canonicalizer_version text NOT NULL,
  trace_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3) document_evidence_flag — quality / conflict flags
CREATE TABLE public.document_evidence_flag (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_id uuid NOT NULL REFERENCES public.document_extraction_canonical(id) ON DELETE CASCADE,
  student_user_id uuid NOT NULL,
  flag_code text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info','warn','blocker')),
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  raised_by text NOT NULL,
  trace_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4) student_award_raw — awards/credentials as reported by source
CREATE TABLE public.student_award_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id uuid NOT NULL,
  source_country_code text NOT NULL,
  award_name_raw text NOT NULL,
  award_year integer,
  award_grade_raw text,
  award_score_raw text,
  source_document_canonical_id uuid REFERENCES public.document_extraction_canonical(id) ON DELETE SET NULL,
  trace_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5) student_credential_normalized — normalizer output
CREATE TABLE public.student_credential_normalized (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id uuid NOT NULL,
  source_award_raw_id uuid REFERENCES public.student_award_raw(id) ON DELETE CASCADE,
  source_country_code text NOT NULL,
  normalized_credential_kind text NOT NULL,
  normalized_credential_subtype text,
  normalized_grade_pct numeric,
  normalized_cefr_level text,
  normalized_language_code text,
  confidence numeric NOT NULL DEFAULT 0,
  needs_manual_review boolean NOT NULL DEFAULT false,
  matched_rule_ids text[] NOT NULL DEFAULT '{}'::text[],
  evidence_ids text[] NOT NULL DEFAULT '{}'::text[],
  normalizer_version text NOT NULL,
  trace_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6) credential_mapping_decision_log — every decision recorded
CREATE TABLE public.credential_mapping_decision_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_id uuid REFERENCES public.student_credential_normalized(id) ON DELETE CASCADE,
  student_user_id uuid NOT NULL,
  source_country_code text NOT NULL,
  decision_kind text NOT NULL,
  reason_code text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  matched_rule_id text,
  evidence_ids text[] NOT NULL DEFAULT '{}'::text[],
  normalizer_version text NOT NULL,
  trace_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_doc_raw_student ON public.document_extraction_raw(student_user_id, created_at DESC);
CREATE INDEX idx_doc_canonical_student ON public.document_extraction_canonical(student_user_id, created_at DESC);
CREATE INDEX idx_doc_canonical_raw ON public.document_extraction_canonical(raw_extraction_id);
CREATE INDEX idx_doc_flag_canonical ON public.document_evidence_flag(canonical_id);
CREATE INDEX idx_award_raw_student ON public.student_award_raw(student_user_id, created_at DESC);
CREATE INDEX idx_cred_norm_student ON public.student_credential_normalized(student_user_id, created_at DESC);
CREATE INDEX idx_cred_norm_award ON public.student_credential_normalized(source_award_raw_id);
CREATE INDEX idx_decision_log_normalized ON public.credential_mapping_decision_log(normalized_id);
CREATE INDEX idx_decision_log_student ON public.credential_mapping_decision_log(student_user_id, created_at DESC);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.document_extraction_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_extraction_canonical ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_evidence_flag ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_award_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_credential_normalized ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credential_mapping_decision_log ENABLE ROW LEVEL SECURITY;

-- Helper: admin check (reuse existing has_role if present)
-- Assumes public.has_role(uuid, app_role) exists per project convention.

-- document_extraction_raw policies
CREATE POLICY "students read own raw extractions"
  ON public.document_extraction_raw FOR SELECT
  USING (auth.uid() = student_user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "students insert own raw extractions"
  ON public.document_extraction_raw FOR INSERT
  WITH CHECK (auth.uid() = student_user_id);

-- document_extraction_canonical policies
CREATE POLICY "students read own canonical extractions"
  ON public.document_extraction_canonical FOR SELECT
  USING (auth.uid() = student_user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "students insert own canonical extractions"
  ON public.document_extraction_canonical FOR INSERT
  WITH CHECK (auth.uid() = student_user_id);

-- document_evidence_flag policies
CREATE POLICY "students read own evidence flags"
  ON public.document_evidence_flag FOR SELECT
  USING (auth.uid() = student_user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "students insert own evidence flags"
  ON public.document_evidence_flag FOR INSERT
  WITH CHECK (auth.uid() = student_user_id);

-- student_award_raw policies
CREATE POLICY "students read own awards raw"
  ON public.student_award_raw FOR SELECT
  USING (auth.uid() = student_user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "students insert own awards raw"
  ON public.student_award_raw FOR INSERT
  WITH CHECK (auth.uid() = student_user_id);

CREATE POLICY "students update own awards raw"
  ON public.student_award_raw FOR UPDATE
  USING (auth.uid() = student_user_id);

CREATE POLICY "students delete own awards raw"
  ON public.student_award_raw FOR DELETE
  USING (auth.uid() = student_user_id);

-- student_credential_normalized policies
CREATE POLICY "students read own normalized credentials"
  ON public.student_credential_normalized FOR SELECT
  USING (auth.uid() = student_user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "students insert own normalized credentials"
  ON public.student_credential_normalized FOR INSERT
  WITH CHECK (auth.uid() = student_user_id);

-- credential_mapping_decision_log policies (read-only audit trail)
CREATE POLICY "students read own decision log"
  ON public.credential_mapping_decision_log FOR SELECT
  USING (auth.uid() = student_user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "students insert own decision log"
  ON public.credential_mapping_decision_log FOR INSERT
  WITH CHECK (auth.uid() = student_user_id);
-- No UPDATE/DELETE policies on decision_log → immutable audit trail