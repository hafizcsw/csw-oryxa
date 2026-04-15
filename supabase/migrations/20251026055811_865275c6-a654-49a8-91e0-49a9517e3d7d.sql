-- Drop old policies
DROP POLICY IF EXISTS "Admins can upload country images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update country images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete country images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view country images" ON storage.objects;

-- Create new policies using is_admin() function
CREATE POLICY "Admins can upload country images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'countries' 
  AND is_admin(auth.uid())
);

CREATE POLICY "Admins can update country images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'countries'
  AND is_admin(auth.uid())
);

CREATE POLICY "Admins can delete country images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'countries'
  AND is_admin(auth.uid())
);

CREATE POLICY "Anyone can view country images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'countries');