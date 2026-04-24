-- ════════════════════════════════════════════════════════════════
-- Phase A — Round 2: Wire workspace to OFFICIAL Phase A tables
-- ════════════════════════════════════════════════════════════════

-- 1) Drop legacy workspace table (no longer source of truth)
DROP TABLE IF EXISTS public.student_normalized_credentials CASCADE;

-- 2) Extend student_award_raw with document linkage + uniqueness
ALTER TABLE public.student_award_raw
  ADD COLUMN IF NOT EXISTS source_document_id text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_award_raw_student_doc
  ON public.student_award_raw(student_user_id, source_document_id)
  WHERE source_document_id IS NOT NULL;

-- 3) Extend student_credential_normalized with workspace fields
ALTER TABLE public.student_credential_normalized
  ADD COLUMN IF NOT EXISTS source_document_id text,
  ADD COLUMN IF NOT EXISTS decisions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS award_year integer,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS uq_cred_norm_student_doc
  ON public.student_credential_normalized(student_user_id, source_document_id)
  WHERE source_document_id IS NOT NULL;

-- Allow update + delete by owner (needed for replace-set semantics)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='student_credential_normalized'
      AND policyname='students update own normalized credentials'
  ) THEN
    CREATE POLICY "students update own normalized credentials"
      ON public.student_credential_normalized FOR UPDATE
      USING (auth.uid() = student_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='student_credential_normalized'
      AND policyname='students delete own normalized credentials'
  ) THEN
    CREATE POLICY "students delete own normalized credentials"
      ON public.student_credential_normalized FOR DELETE
      USING (auth.uid() = student_user_id);
  END IF;
END$$;

-- 4) Rebuild student_evaluation_snapshots aligned with Phase A
DROP TABLE IF EXISTS public.student_evaluation_snapshots CASCADE;

CREATE TABLE public.student_evaluation_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id uuid NOT NULL UNIQUE,
  input_hash text NOT NULL,
  rules_version text NOT NULL,
  document_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  result jsonb NOT NULL,
  needs_manual_review boolean NOT NULL DEFAULT false,
  last_computed_at timestamptz NOT NULL DEFAULT now(),
  recompute_reason text,
  trace_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ses_student ON public.student_evaluation_snapshots(student_user_id);

ALTER TABLE public.student_evaluation_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students read own snapshot"
  ON public.student_evaluation_snapshots FOR SELECT
  USING (auth.uid() = student_user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "students insert own snapshot"
  ON public.student_evaluation_snapshots FOR INSERT
  WITH CHECK (auth.uid() = student_user_id);

CREATE POLICY "students update own snapshot"
  ON public.student_evaluation_snapshots FOR UPDATE
  USING (auth.uid() = student_user_id);

CREATE POLICY "students delete own snapshot"
  ON public.student_evaluation_snapshots FOR DELETE
  USING (auth.uid() = student_user_id);

-- 5) updated_at triggers (reuse helper if present)
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

DROP TRIGGER IF EXISTS trg_ses_updated_at ON public.student_evaluation_snapshots;
CREATE TRIGGER trg_ses_updated_at
  BEFORE UPDATE ON public.student_evaluation_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

DROP TRIGGER IF EXISTS trg_cred_norm_updated_at ON public.student_credential_normalized;
CREATE TRIGGER trg_cred_norm_updated_at
  BEFORE UPDATE ON public.student_credential_normalized
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();