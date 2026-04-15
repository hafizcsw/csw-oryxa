-- Create storage bucket for program images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'program-images',
  'program-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for scholarship images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'scholarship-images',
  'scholarship-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for program-images bucket
CREATE POLICY "Program images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'program-images');

CREATE POLICY "Authenticated users can upload program images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'program-images'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update program images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'program-images'
  AND auth.role() = 'authenticated'
);

-- Create RLS policies for scholarship-images bucket
CREATE POLICY "Scholarship images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'scholarship-images');

CREATE POLICY "Authenticated users can upload scholarship images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'scholarship-images'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update scholarship images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'scholarship-images'
  AND auth.role() = 'authenticated'
);