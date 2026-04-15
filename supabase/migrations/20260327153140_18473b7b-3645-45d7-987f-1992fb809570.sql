
CREATE TABLE public.teacher_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_email TEXT NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'other',
  file_name TEXT NOT NULL,
  file_url TEXT,
  storage_bucket TEXT DEFAULT 'teacher-docs',
  storage_path TEXT,
  mime_type TEXT DEFAULT 'application/octet-stream',
  size_bytes BIGINT DEFAULT 0,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  reviewer_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.teacher_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on teacher_documents"
  ON public.teacher_documents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_teacher_documents_staff_email ON public.teacher_documents(staff_email);
