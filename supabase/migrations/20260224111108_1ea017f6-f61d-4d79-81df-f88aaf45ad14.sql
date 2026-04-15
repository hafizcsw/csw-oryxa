
-- Create storage bucket for AI-generated country images
INSERT INTO storage.buckets (id, name, public)
VALUES ('country-images', 'country-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public read access for country images"
ON storage.objects FOR SELECT
USING (bucket_id = 'country-images');

-- Allow service role to upload
CREATE POLICY "Service role upload for country images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'country-images');
