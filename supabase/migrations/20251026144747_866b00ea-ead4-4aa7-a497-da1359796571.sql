-- Create university-media storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'university-media',
  'university-media',
  true,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/jpg']
);

-- RLS: Anyone can view university media
CREATE POLICY "Anyone can view university media"
ON storage.objects FOR SELECT
USING (bucket_id = 'university-media');

-- RLS: Admins can upload university media
CREATE POLICY "Admins can upload university media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'university-media' 
  AND auth.uid() IN (
    SELECT user_id FROM user_roles WHERE role = 'admin'
  )
);

-- RLS: Admins can update university media
CREATE POLICY "Admins can update university media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'university-media'
  AND auth.uid() IN (
    SELECT user_id FROM user_roles WHERE role = 'admin'
  )
);

-- RLS: Admins can delete university media
CREATE POLICY "Admins can delete university media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'university-media'
  AND auth.uid() IN (
    SELECT user_id FROM user_roles WHERE role = 'admin'
  )
);