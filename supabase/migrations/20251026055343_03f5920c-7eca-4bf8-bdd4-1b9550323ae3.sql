-- Create storage bucket for country images
INSERT INTO storage.buckets (id, name, public)
VALUES ('countries', 'countries', true)
ON CONFLICT (id) DO NOTHING;

-- Allow admins to upload country images
CREATE POLICY "Admins can upload country images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'countries' 
  AND (auth.jwt()->>'is_admin')::boolean = true
);

-- Allow admins to update country images
CREATE POLICY "Admins can update country images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'countries'
  AND (auth.jwt()->>'is_admin')::boolean = true
);

-- Allow admins to delete country images
CREATE POLICY "Admins can delete country images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'countries'
  AND (auth.jwt()->>'is_admin')::boolean = true
);

-- Allow public to view country images
CREATE POLICY "Anyone can view country images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'countries');