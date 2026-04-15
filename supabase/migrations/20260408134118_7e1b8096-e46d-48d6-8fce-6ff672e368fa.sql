-- Allow authenticated users to upload to university-media bucket
CREATE POLICY "Authenticated users can upload university media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'university-media');

-- Allow authenticated users to upload to university-logos bucket
CREATE POLICY "Authenticated users can upload university logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'university-logos');