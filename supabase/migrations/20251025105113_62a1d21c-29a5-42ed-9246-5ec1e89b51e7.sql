-- إنشاء storage bucket للـ ingest
INSERT INTO storage.buckets (id, name, public)
VALUES ('ingest', 'ingest', false)
ON CONFLICT (id) DO NOTHING;

-- إنشاء سياسات للإدمن فقط (باستخدام DO block)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Admins can upload ingest files'
  ) THEN
    CREATE POLICY "Admins can upload ingest files"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'ingest' AND is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Admins can view ingest files'
  ) THEN
    CREATE POLICY "Admins can view ingest files"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'ingest' AND is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Admins can delete ingest files'
  ) THEN
    CREATE POLICY "Admins can delete ingest files"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'ingest' AND is_admin(auth.uid()));
  END IF;
END $$;