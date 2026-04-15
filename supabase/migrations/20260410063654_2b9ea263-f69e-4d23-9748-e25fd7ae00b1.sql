
CREATE TABLE public.university_page_staff_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL,
  email TEXT NOT NULL,
  intended_role TEXT NOT NULL,
  invited_by UUID NOT NULL,
  token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID,
  CONSTRAINT valid_invite_status CHECK (status IN ('pending','accepted','revoked','expired'))
);

CREATE INDEX idx_staff_inv_university ON public.university_page_staff_invitations(university_id);
CREATE INDEX idx_staff_inv_email ON public.university_page_staff_invitations(email);
CREATE INDEX idx_staff_inv_token ON public.university_page_staff_invitations(token_hash);
CREATE UNIQUE INDEX idx_staff_inv_active ON public.university_page_staff_invitations(university_id, email) WHERE status = 'pending';

ALTER TABLE public.university_page_staff_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view university invitations"
  ON public.university_page_staff_invitations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.university_page_staff ups
      WHERE ups.university_id = university_page_staff_invitations.university_id
        AND ups.user_id = auth.uid()
        AND ups.role IN ('full_control', 'page_admin')
        AND ups.status = 'active'
    )
  );
