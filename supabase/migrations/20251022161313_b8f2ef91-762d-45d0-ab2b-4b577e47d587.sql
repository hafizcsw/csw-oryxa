-- Create storage bucket for university images
INSERT INTO storage.buckets (id, name, public)
VALUES ('universities', 'universities', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for university images bucket
CREATE POLICY "Public can view university images"
ON storage.objects FOR SELECT
USING (bucket_id = 'universities');

CREATE POLICY "Admins can upload university images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'universities' 
  AND auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
);

CREATE POLICY "Admins can update university images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'universities'
  AND auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
);

CREATE POLICY "Admins can delete university images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'universities'
  AND auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
);