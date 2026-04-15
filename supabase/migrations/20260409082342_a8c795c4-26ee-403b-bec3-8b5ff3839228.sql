-- Governed field edits for public-truth boundary
CREATE TABLE public.governed_field_edits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('program', 'scholarship')),
  entity_id UUID NOT NULL,
  university_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  old_value JSONB,
  proposed_value JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_by UUID NOT NULL,
  reviewed_by UUID,
  reviewer_note TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX idx_governed_edits_university ON public.governed_field_edits(university_id, status);
CREATE INDEX idx_governed_edits_entity ON public.governed_field_edits(entity_type, entity_id, status);
CREATE INDEX idx_governed_edits_submitter ON public.governed_field_edits(submitted_by, status);

-- RLS
ALTER TABLE public.governed_field_edits ENABLE ROW LEVEL SECURITY;

-- Staff can view edits for their university
CREATE POLICY "Staff can view university governed edits"
ON public.governed_field_edits
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.university_page_staff ups
    WHERE ups.university_id = governed_field_edits.university_id
      AND ups.user_id = auth.uid()
      AND ups.status = 'active'
      AND ups.role IN ('full_control', 'page_admin')
  )
  OR public.is_admin(auth.uid()) = true
  OR submitted_by = auth.uid()
);

-- Only edge functions (service role) insert/update
CREATE POLICY "Service role manages governed edits"
ON public.governed_field_edits
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);