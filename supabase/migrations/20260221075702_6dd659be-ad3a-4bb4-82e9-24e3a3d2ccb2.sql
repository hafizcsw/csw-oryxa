
-- Create archive table for old drafts
CREATE TABLE IF NOT EXISTS public.program_draft_archive (
  LIKE public.program_draft INCLUDING ALL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  archive_reason text NOT NULL
);

-- No RLS needed - admin-only table
ALTER TABLE public.program_draft_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin only access" ON public.program_draft_archive
  FOR ALL USING (public.is_admin(auth.uid()));
