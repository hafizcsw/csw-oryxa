
-- 1. Intake Status History (audit trail for every status transition)
CREATE TABLE public.intake_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES public.intake_applications(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_intake_status_history_app ON public.intake_status_history(application_id);
CREATE INDEX idx_intake_status_history_created ON public.intake_status_history(created_at);

ALTER TABLE public.intake_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own app history"
  ON public.intake_status_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.intake_applications ia
      WHERE ia.id = intake_status_history.application_id
        AND ia.user_id = auth.uid()
    )
  );

CREATE POLICY "Operators view university app history"
  ON public.intake_status_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.intake_applications ia
      WHERE ia.id = intake_status_history.application_id
        AND (
          EXISTS (SELECT 1 FROM public.university_page_staff ups WHERE ups.user_id = auth.uid() AND ups.university_id = ia.university_id AND ups.status = 'active')
          OR EXISTS (SELECT 1 FROM public.institution_claims ic WHERE ic.user_id = auth.uid() AND ic.institution_id = ia.university_id AND ic.status = 'approved')
        )
    )
  );

CREATE POLICY "Operators insert history"
  ON public.intake_status_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.intake_applications ia
      WHERE ia.id = intake_status_history.application_id
        AND (
          EXISTS (SELECT 1 FROM public.university_page_staff ups WHERE ups.user_id = auth.uid() AND ups.university_id = ia.university_id AND ups.status = 'active')
          OR EXISTS (SELECT 1 FROM public.institution_claims ic WHERE ic.user_id = auth.uid() AND ic.institution_id = ia.university_id AND ic.status = 'approved')
        )
    )
  );

-- 2. Intake Document Requests
CREATE TABLE public.intake_doc_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES public.intake_applications(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL,
  doc_type TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'requested',
  comm_thread_id UUID REFERENCES public.comm_threads(id),
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_intake_doc_requests_app ON public.intake_doc_requests(application_id);

ALTER TABLE public.intake_doc_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own doc requests"
  ON public.intake_doc_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.intake_applications ia
      WHERE ia.id = intake_doc_requests.application_id
        AND ia.user_id = auth.uid()
    )
  );

CREATE POLICY "Operators view university doc requests"
  ON public.intake_doc_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.intake_applications ia
      WHERE ia.id = intake_doc_requests.application_id
        AND (
          EXISTS (SELECT 1 FROM public.university_page_staff ups WHERE ups.user_id = auth.uid() AND ups.university_id = ia.university_id AND ups.status = 'active')
          OR EXISTS (SELECT 1 FROM public.institution_claims ic WHERE ic.user_id = auth.uid() AND ic.institution_id = ia.university_id AND ic.status = 'approved')
        )
    )
  );

CREATE POLICY "Operators create doc requests"
  ON public.intake_doc_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.intake_applications ia
      WHERE ia.id = intake_doc_requests.application_id
        AND (
          EXISTS (SELECT 1 FROM public.university_page_staff ups WHERE ups.user_id = auth.uid() AND ups.university_id = ia.university_id AND ups.status = 'active')
          OR EXISTS (SELECT 1 FROM public.institution_claims ic WHERE ic.user_id = auth.uid() AND ic.institution_id = ia.university_id AND ic.status = 'approved')
        )
    )
  );

CREATE POLICY "Operators update doc requests"
  ON public.intake_doc_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.intake_applications ia
      WHERE ia.id = intake_doc_requests.application_id
        AND (
          EXISTS (SELECT 1 FROM public.university_page_staff ups WHERE ups.user_id = auth.uid() AND ups.university_id = ia.university_id AND ups.status = 'active')
          OR EXISTS (SELECT 1 FROM public.institution_claims ic WHERE ic.user_id = auth.uid() AND ic.institution_id = ia.university_id AND ic.status = 'approved')
        )
    )
  );

-- 3. Intake Reviewer Notes
CREATE TABLE public.intake_reviewer_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES public.intake_applications(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  note TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'internal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_intake_reviewer_notes_app ON public.intake_reviewer_notes(application_id);

ALTER TABLE public.intake_reviewer_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators view notes"
  ON public.intake_reviewer_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.intake_applications ia
      WHERE ia.id = intake_reviewer_notes.application_id
        AND (
          EXISTS (SELECT 1 FROM public.university_page_staff ups WHERE ups.user_id = auth.uid() AND ups.university_id = ia.university_id AND ups.status = 'active')
          OR EXISTS (SELECT 1 FROM public.institution_claims ic WHERE ic.user_id = auth.uid() AND ic.institution_id = ia.university_id AND ic.status = 'approved')
        )
    )
  );

CREATE POLICY "Students view shared notes"
  ON public.intake_reviewer_notes FOR SELECT
  TO authenticated
  USING (
    visibility = 'shared'
    AND EXISTS (
      SELECT 1 FROM public.intake_applications ia
      WHERE ia.id = intake_reviewer_notes.application_id
        AND ia.user_id = auth.uid()
    )
  );

CREATE POLICY "Operators create notes"
  ON public.intake_reviewer_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.intake_applications ia
      WHERE ia.id = intake_reviewer_notes.application_id
        AND (
          EXISTS (SELECT 1 FROM public.university_page_staff ups WHERE ups.user_id = auth.uid() AND ups.university_id = ia.university_id AND ups.status = 'active')
          OR EXISTS (SELECT 1 FROM public.institution_claims ic WHERE ic.user_id = auth.uid() AND ic.institution_id = ia.university_id AND ic.status = 'approved')
        )
    )
  );

-- Add updated_at trigger for doc_requests
CREATE TRIGGER update_intake_doc_requests_updated_at
  BEFORE UPDATE ON public.intake_doc_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.intake_status_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.intake_doc_requests;
