-- Fix 1: Add public read policy for published slides using DO block
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'slider_universities' 
    AND policyname = 'slider_read_published_public'
  ) THEN
    CREATE POLICY slider_read_published_public
    ON slider_universities
    FOR SELECT
    USING (
      published = true
      AND (start_at IS NULL OR start_at <= now())
      AND (end_at IS NULL OR end_at >= now())
    );
  END IF;
END $$;

-- Fix 2: Update view to return unified field names using only existing columns
CREATE OR REPLACE VIEW vw_slider_active AS
SELECT
  s.id,
  s.university_id,
  COALESCE(s.image_url, u.logo_url) AS image_url,
  s.alt_text,
  s.locale,
  s.weight,
  u.id::text AS university_slug,
  u.name AS university_name,
  u.logo_url
FROM slider_universities s
JOIN universities u ON u.id = s.university_id
WHERE s.published = true
  AND (s.start_at IS NULL OR s.start_at <= now())
  AND (s.end_at IS NULL OR s.end_at >= now())
ORDER BY s.locale, s.weight, s.id;