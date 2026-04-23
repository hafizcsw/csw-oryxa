-- Hero reveal videos bucket (public read, 200MB cap covers 2K H.264 ~17s)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hero-videos',
  'hero-videos',
  true,
  209715200,
  ARRAY['video/mp4','video/webm','video/quicktime']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read so the homepage can stream the video
DROP POLICY IF EXISTS "Hero videos are publicly readable" ON storage.objects;
CREATE POLICY "Hero videos are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'hero-videos');

-- Admin-only writes via the existing has_role(uuid, app_role) function
DROP POLICY IF EXISTS "Admins upload hero videos" ON storage.objects;
CREATE POLICY "Admins upload hero videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'hero-videos'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Admins update hero videos" ON storage.objects;
CREATE POLICY "Admins update hero videos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'hero-videos'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Admins delete hero videos" ON storage.objects;
CREATE POLICY "Admins delete hero videos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'hero-videos'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Default settings row for the hero reveal video (idempotent)
INSERT INTO public.feature_settings (key, value)
VALUES (
  'hero_reveal_video',
  jsonb_build_object(
    'enabled', false,
    'url', null,
    'poster_url', null,
    'updated_at', now()
  )
)
ON CONFLICT (key) DO NOTHING;