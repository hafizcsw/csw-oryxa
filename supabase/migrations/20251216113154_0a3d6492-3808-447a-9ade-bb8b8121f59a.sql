-- Portal Files V1 (Ready Downloads + Upload Tracking)
CREATE TABLE IF NOT EXISTS public.portal_files_v1 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL REFERENCES auth.users(id),
  application_id uuid NULL REFERENCES public.portal_applications_v1(id) ON DELETE SET NULL,
  file_kind text NOT NULL, -- admission_letter, contract, visa, passport, certificate, photo, invoice, receipt, etc.
  file_name text NOT NULL,
  title text NULL,
  storage_bucket text NOT NULL DEFAULT 'student-docs',
  storage_path text NOT NULL,
  mime_type text NULL,
  size_bytes bigint NULL,
  status text NOT NULL DEFAULT 'ready', -- ready, hidden, rejected, approved, pending_review
  admin_notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.portal_files_v1 ENABLE ROW LEVEL SECURITY;

-- Owner can read their own files
CREATE POLICY "portal_files_v1_owner_read"
ON public.portal_files_v1 FOR SELECT
USING (auth.uid() = auth_user_id);

-- Owner can insert their own files
CREATE POLICY "portal_files_v1_owner_insert"
ON public.portal_files_v1 FOR INSERT
WITH CHECK (auth.uid() = auth_user_id);

-- Owner can delete their own files (with status check)
CREATE POLICY "portal_files_v1_owner_delete"
ON public.portal_files_v1 FOR DELETE
USING (auth.uid() = auth_user_id AND status IN ('ready', 'pending_review'));

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_portal_files_v1_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_portal_files_v1_updated_at
BEFORE UPDATE ON public.portal_files_v1
FOR EACH ROW
EXECUTE FUNCTION update_portal_files_v1_updated_at();

-- Index for quick lookups
CREATE INDEX idx_portal_files_v1_auth_user ON public.portal_files_v1(auth_user_id);
CREATE INDEX idx_portal_files_v1_kind ON public.portal_files_v1(file_kind);
CREATE INDEX idx_portal_files_v1_application ON public.portal_files_v1(application_id);