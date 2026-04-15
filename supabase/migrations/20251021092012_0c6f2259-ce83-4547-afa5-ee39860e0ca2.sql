-- Create storage buckets for contracts and translations

-- Contracts bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', false)
ON CONFLICT (id) DO NOTHING;

-- Translations bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('translations', 'translations', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for contracts bucket
CREATE POLICY "Users can view their own contracts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'contracts' AND
  (auth.uid()::text = (storage.foldername(name))[1] OR is_admin(auth.uid()))
);

CREATE POLICY "Admins can upload contracts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'contracts' AND
  is_admin(auth.uid())
);

-- Storage policies for translations bucket
CREATE POLICY "Users can view their translations"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'translations' AND
  (auth.uid()::text = (storage.foldername(name))[1] OR is_admin(auth.uid()))
);

CREATE POLICY "Admins can upload translations"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'translations' AND
  is_admin(auth.uid())
);