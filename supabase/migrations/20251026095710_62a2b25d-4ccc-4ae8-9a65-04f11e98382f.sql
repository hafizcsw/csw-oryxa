-- Create storage bucket for university images if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('university-images', 'university-images', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public Access to university images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload university images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update university images" ON storage.objects;

-- Create RLS policies for university images bucket
CREATE POLICY "Public Access to university images"
ON storage.objects FOR SELECT
USING (bucket_id = 'university-images');

CREATE POLICY "Authenticated users can upload university images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'university-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update university images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'university-images' AND auth.role() = 'authenticated');