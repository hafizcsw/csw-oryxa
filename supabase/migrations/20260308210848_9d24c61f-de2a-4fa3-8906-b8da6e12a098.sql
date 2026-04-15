INSERT INTO storage.buckets (id, name, public) VALUES ('university-assets', 'university-assets', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read university-assets" ON storage.objects FOR SELECT USING (bucket_id = 'university-assets');
CREATE POLICY "Service insert university-assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'university-assets');