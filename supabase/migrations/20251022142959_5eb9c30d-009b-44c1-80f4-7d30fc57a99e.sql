-- إنشاء جدول slider_universities (university_id as UUID)
CREATE TABLE IF NOT EXISTS slider_universities (
  id            bigserial PRIMARY KEY,
  university_id uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  image_url     text,
  alt_text      text,
  locale        text NOT NULL DEFAULT 'ar' CHECK (locale IN ('ar','en')),
  weight        int  NOT NULL DEFAULT 0,
  start_at      timestamptz,
  end_at        timestamptz,
  published     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  last_editor   uuid
);

CREATE INDEX IF NOT EXISTS idx_slider_locale ON slider_universities(locale);
CREATE INDEX IF NOT EXISTS idx_slider_weight ON slider_universities(locale, weight);
CREATE INDEX IF NOT EXISTS idx_slider_active ON slider_universities(published, start_at, end_at);

-- Trigger لتحديث updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; 
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_slider_updated ON slider_universities;
CREATE TRIGGER trg_slider_updated BEFORE UPDATE ON slider_universities
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- تفعيل RLS
ALTER TABLE slider_universities ENABLE ROW LEVEL SECURITY;

-- سياسة قراءة للإدارة
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'slider_universities' AND policyname = 'slider_read_admin'
  ) THEN
    CREATE POLICY slider_read_admin ON slider_universities
      FOR SELECT USING (is_admin(auth.uid()));
  END IF;
END $$;

-- سياسة كتابة لـsuper_admin فقط  
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'slider_universities' AND policyname = 'slider_write_super'
  ) THEN
    CREATE POLICY slider_write_super ON slider_universities
      FOR ALL USING (is_admin(auth.uid()))
      WITH CHECK (is_admin(auth.uid()));
  END IF;
END $$;

-- سياسة قراءة عامة للزوار (العناصر المنشورة فقط)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'slider_universities' AND policyname = 'slider_read_published_public'
  ) THEN
    CREATE POLICY slider_read_published_public ON slider_universities
      FOR SELECT USING (
        published = true
        AND (start_at IS NULL OR start_at <= now())
        AND (end_at IS NULL OR end_at >= now())
      );
  END IF;
END $$;

-- View للعناصر النشطة (يستخدم الحقول الموجودة: name, id)
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