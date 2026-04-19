-- ═══════════════════════════════════════════════════════════════
-- DOOR 3 — Heavy recovery + transcript persistence
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ─── ENUMS ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.door3_job_type AS ENUM (
    'internal_ocr','transcript_parse','passport_recovery','certificate_recovery'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.door3_job_status AS ENUM (
    'queued','worker_not_configured','processing','completed','failed','needs_review'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.door3_review_state AS ENUM (
    'pending','approved','rejected','keep_needs_review'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── document_jobs ─────────────────────────────────────────────
CREATE TABLE public.document_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL,
  user_id       UUID NOT NULL,
  job_type      public.door3_job_type NOT NULL,
  status        public.door3_job_status NOT NULL DEFAULT 'queued',
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  result        JSONB,
  attempts      INT NOT NULL DEFAULT 0,
  max_attempts  INT NOT NULL DEFAULT 3,
  last_error    TEXT,
  scheduled_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  claim_token   UUID,
  claimed_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_document_jobs_status_scheduled
  ON public.document_jobs (status, scheduled_at)
  WHERE status IN ('queued','processing');
CREATE INDEX idx_document_jobs_document ON public.document_jobs (document_id);
CREATE INDEX idx_document_jobs_user     ON public.document_jobs (user_id);
CREATE UNIQUE INDEX uq_document_jobs_active
  ON public.document_jobs (document_id, job_type)
  WHERE status IN ('queued','processing','worker_not_configured');
ALTER TABLE public.document_jobs ENABLE ROW LEVEL SECURITY;

-- ─── document_ocr_evidence ─────────────────────────────────────
CREATE TABLE public.document_ocr_evidence (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id       UUID NOT NULL,
  user_id           UUID NOT NULL,
  content_kind      TEXT NOT NULL CHECK (content_kind IN ('image','scanned_pdf','pdf_text')),
  page_count        INT NOT NULL DEFAULT 0,
  pages             JSONB NOT NULL DEFAULT '[]'::jsonb,
  processing_notes  JSONB NOT NULL DEFAULT '[]'::jsonb,
  engine            TEXT NOT NULL,
  engine_version    TEXT,
  processed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_document_ocr_evidence_document ON public.document_ocr_evidence (document_id);
CREATE INDEX idx_document_ocr_evidence_user     ON public.document_ocr_evidence (user_id);
ALTER TABLE public.document_ocr_evidence ENABLE ROW LEVEL SECURITY;

-- ─── document_academic_rows ────────────────────────────────────
CREATE TABLE public.document_academic_rows (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id              UUID NOT NULL,
  user_id                  UUID NOT NULL,
  academic_period          TEXT,
  subject_name_raw         TEXT,
  subject_name_normalized  TEXT,
  mark_raw                 TEXT,
  mark_numeric             NUMERIC,
  credit_hours_raw         TEXT,
  credit_hours_numeric     NUMERIC,
  grade_raw                TEXT,
  row_confidence           NUMERIC NOT NULL DEFAULT 0,
  provenance               JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_document_academic_rows_document ON public.document_academic_rows (document_id);
CREATE INDEX idx_document_academic_rows_user     ON public.document_academic_rows (user_id);
ALTER TABLE public.document_academic_rows ENABLE ROW LEVEL SECURITY;

-- ─── document_academic_summary ─────────────────────────────────
CREATE TABLE public.document_academic_summary (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id               UUID NOT NULL,
  user_id                   UUID NOT NULL,
  metric_type               TEXT NOT NULL,
  raw_label                 TEXT,
  normalized_label          TEXT,
  raw_value                 TEXT,
  normalized_numeric_value  NUMERIC,
  confidence                NUMERIC NOT NULL DEFAULT 0,
  provenance                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_document_academic_summary_document ON public.document_academic_summary (document_id);
CREATE INDEX idx_document_academic_summary_user     ON public.document_academic_summary (user_id);
ALTER TABLE public.document_academic_summary ENABLE ROW LEVEL SECURITY;

-- ─── document_review_queue ─────────────────────────────────────
CREATE TABLE public.document_review_queue (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id         UUID NOT NULL,
  user_id             UUID NOT NULL,
  lane                TEXT NOT NULL,
  reason              TEXT NOT NULL,
  evidence_summary    JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence_summary  JSONB NOT NULL DEFAULT '{}'::jsonb,
  state               public.door3_review_state NOT NULL DEFAULT 'pending',
  resolved_by         UUID,
  resolved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_document_review_queue_doc_pending
  ON public.document_review_queue (document_id) WHERE state = 'pending';
CREATE INDEX idx_document_review_queue_state ON public.document_review_queue (state);
ALTER TABLE public.document_review_queue ENABLE ROW LEVEL SECURITY;

-- ─── updated_at trigger function ───────────────────────────────
CREATE OR REPLACE FUNCTION public.door3_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $f$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$f$;

CREATE TRIGGER trg_document_jobs_updated_at
  BEFORE UPDATE ON public.document_jobs
  FOR EACH ROW EXECUTE FUNCTION public.door3_touch_updated_at();
CREATE TRIGGER trg_document_academic_rows_updated_at
  BEFORE UPDATE ON public.document_academic_rows
  FOR EACH ROW EXECUTE FUNCTION public.door3_touch_updated_at();
CREATE TRIGGER trg_document_academic_summary_updated_at
  BEFORE UPDATE ON public.document_academic_summary
  FOR EACH ROW EXECUTE FUNCTION public.door3_touch_updated_at();
CREATE TRIGGER trg_document_review_queue_updated_at
  BEFORE UPDATE ON public.document_review_queue
  FOR EACH ROW EXECUTE FUNCTION public.door3_touch_updated_at();

-- ─── RLS POLICIES ──────────────────────────────────────────────
-- Owner policies
CREATE POLICY "owner_select_jobs" ON public.document_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "owner_insert_jobs" ON public.document_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_update_jobs" ON public.document_jobs FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "owner_select_ocr" ON public.document_ocr_evidence FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "owner_insert_ocr" ON public.document_ocr_evidence FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owner_select_rows" ON public.document_academic_rows FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "owner_insert_rows" ON public.document_academic_rows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_update_rows" ON public.document_academic_rows FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "owner_delete_rows" ON public.document_academic_rows FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "owner_select_summary" ON public.document_academic_summary FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "owner_insert_summary" ON public.document_academic_summary FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_update_summary" ON public.document_academic_summary FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "owner_delete_summary" ON public.document_academic_summary FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "owner_select_review" ON public.document_review_queue FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "owner_insert_review" ON public.document_review_queue FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Staff policies (admin + moderator) — uses existing public.has_role
CREATE POLICY "staff_select_jobs" ON public.document_jobs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role));
CREATE POLICY "staff_select_ocr" ON public.document_ocr_evidence FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role));
CREATE POLICY "staff_select_rows" ON public.document_academic_rows FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role));
CREATE POLICY "staff_select_summary" ON public.document_academic_summary FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role));
CREATE POLICY "staff_all_review" ON public.document_review_queue FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role));

-- ─── HELPER FUNCTIONS ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_door3_jobs(_batch_size INT DEFAULT 5)
RETURNS SETOF public.document_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _token UUID := gen_random_uuid();
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT id FROM public.document_jobs
    WHERE status = 'queued' AND scheduled_at <= now()
    ORDER BY scheduled_at
    FOR UPDATE SKIP LOCKED
    LIMIT _batch_size
  )
  UPDATE public.document_jobs j
     SET status = 'processing', claim_token = _token, claimed_at = now(),
         started_at = COALESCE(j.started_at, now()), attempts = j.attempts + 1
   FROM picked
  WHERE j.id = picked.id
  RETURNING j.*;
END $$;

CREATE OR REPLACE FUNCTION public.enqueue_door3_followup(
  _document_id UUID, _user_id UUID,
  _job_type public.door3_job_type, _payload JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _existing UUID; _new_id UUID;
BEGIN
  SELECT id INTO _existing FROM public.document_jobs
   WHERE document_id = _document_id AND job_type = _job_type
     AND status IN ('queued','processing','worker_not_configured');
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;

  INSERT INTO public.document_jobs (document_id, user_id, job_type, payload)
  VALUES (_document_id, _user_id, _job_type, COALESCE(_payload,'{}'::jsonb))
  RETURNING id INTO _new_id;
  RETURN _new_id;
END $$;