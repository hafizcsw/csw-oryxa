-- Institution page edits: block-scoped proposals from verified institution users
CREATE TABLE public.institution_page_edits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  university_id UUID NOT NULL,
  submitted_by UUID NOT NULL,
  block_type TEXT NOT NULL CHECK (block_type IN ('about', 'gallery')),
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'published')),
  reviewer_id UUID,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_ipe_university_status ON public.institution_page_edits (university_id, status);
CREATE INDEX idx_ipe_submitted_by ON public.institution_page_edits (submitted_by);

-- Enable RLS
ALTER TABLE public.institution_page_edits ENABLE ROW LEVEL SECURITY;

-- Policy: institution users can see their own edits
CREATE POLICY "Institution users can view own edits"
ON public.institution_page_edits
FOR SELECT
TO authenticated
USING (submitted_by = auth.uid());

-- Policy: institution users can insert edits for their verified university
CREATE POLICY "Institution users can create edits"
ON public.institution_page_edits
FOR INSERT
TO authenticated
WITH CHECK (
  submitted_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.institution_claims
    WHERE institution_claims.user_id = auth.uid()
    AND institution_claims.institution_id = institution_page_edits.university_id
    AND institution_claims.status = 'approved'
  )
);

-- Policy: admins can view all edits
CREATE POLICY "Admins can view all edits"
ON public.institution_page_edits
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Policy: admins can update edits (approve/reject)
CREATE POLICY "Admins can update edits"
ON public.institution_page_edits
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_institution_page_edits_updated_at
BEFORE UPDATE ON public.institution_page_edits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();