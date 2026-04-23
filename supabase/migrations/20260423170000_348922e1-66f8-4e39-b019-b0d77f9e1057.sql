-- ═══════════════════════════════════════════════════════════════
-- Phase A — Student Evaluation Workspace persistence
-- ═══════════════════════════════════════════════════════════════

-- 1) Per-document normalized credential (source-side normalizer output)
CREATE TABLE IF NOT EXISTS public.student_normalized_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  document_id TEXT NOT NULL,
  source_country TEXT,
  normalized_credential_kind TEXT,
  normalized_credential_subtype TEXT,
  normalized_grade_pct NUMERIC,
  award_year INTEGER,
  matched_rule_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  decisions JSONB NOT NULL DEFAULT '[]'::jsonb,
  needs_manual_review BOOLEAN NOT NULL DEFAULT false,
  rules_version TEXT NOT NULL,
  content_hash TEXT,
  raw_input JSONB,
  raw_output JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_snc_user ON public.student_normalized_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_snc_user_doc ON public.student_normalized_credentials(user_id, document_id);

ALTER TABLE public.student_normalized_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "snc_owner_select" ON public.student_normalized_credentials
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "snc_owner_insert" ON public.student_normalized_credentials
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "snc_owner_update" ON public.student_normalized_credentials
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "snc_owner_delete" ON public.student_normalized_credentials
  FOR DELETE USING (auth.uid() = user_id);

-- 2) Whole-student evaluation snapshot
CREATE TABLE IF NOT EXISTS public.student_evaluation_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  input_hash TEXT NOT NULL,
  rules_version TEXT NOT NULL,
  document_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  result JSONB NOT NULL,
  needs_manual_review BOOLEAN NOT NULL DEFAULT false,
  last_computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recompute_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ses_user ON public.student_evaluation_snapshots(user_id);

ALTER TABLE public.student_evaluation_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ses_owner_select" ON public.student_evaluation_snapshots
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ses_owner_insert" ON public.student_evaluation_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ses_owner_update" ON public.student_evaluation_snapshots
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ses_owner_delete" ON public.student_evaluation_snapshots
  FOR DELETE USING (auth.uid() = user_id);

-- 3) Shared updated_at trigger (reuse existing helper if present)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at_now') THEN
    CREATE FUNCTION public.set_updated_at_now()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SET search_path = public
    AS $fn$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $fn$;
  END IF;
END$$;

DROP TRIGGER IF EXISTS trg_snc_updated_at ON public.student_normalized_credentials;
CREATE TRIGGER trg_snc_updated_at
  BEFORE UPDATE ON public.student_normalized_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

DROP TRIGGER IF EXISTS trg_ses_updated_at ON public.student_evaluation_snapshots;
CREATE TRIGGER trg_ses_updated_at
  BEFORE UPDATE ON public.student_evaluation_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();