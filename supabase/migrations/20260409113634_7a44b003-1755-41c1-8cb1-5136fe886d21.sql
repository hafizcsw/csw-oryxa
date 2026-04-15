
CREATE TABLE public.intake_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  program_id UUID NOT NULL,
  university_id UUID NOT NULL,
  file_quality_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  overall_score INTEGER NOT NULL DEFAULT 0,
  verdict TEXT NOT NULL DEFAULT 'incomplete',
  status TEXT NOT NULL DEFAULT 'submitted',
  reviewer_id UUID,
  reviewer_notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_intake_app_user ON public.intake_applications(user_id);
CREATE INDEX idx_intake_app_university ON public.intake_applications(university_id);
CREATE INDEX idx_intake_app_program ON public.intake_applications(program_id);
CREATE INDEX idx_intake_app_status ON public.intake_applications(status);

ALTER TABLE public.intake_applications ENABLE ROW LEVEL SECURITY;

-- Students see own applications
CREATE POLICY "Students view own applications"
  ON public.intake_applications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Students can submit
CREATE POLICY "Students submit applications"
  ON public.intake_applications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Approved operators view their university applications
CREATE POLICY "Operators view university applications"
  ON public.intake_applications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.institution_claims ic
      WHERE ic.user_id = auth.uid()
        AND ic.institution_id = intake_applications.university_id
        AND ic.status = 'approved'
    )
  );

-- Approved operators can update (review)
CREATE POLICY "Operators review applications"
  ON public.intake_applications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.institution_claims ic
      WHERE ic.user_id = auth.uid()
        AND ic.institution_id = intake_applications.university_id
        AND ic.status = 'approved'
    )
  );

CREATE TRIGGER update_intake_applications_updated_at
  BEFORE UPDATE ON public.intake_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.intake_applications;
