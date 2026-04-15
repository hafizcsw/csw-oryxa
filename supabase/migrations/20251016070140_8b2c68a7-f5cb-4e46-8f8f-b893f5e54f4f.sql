-- 1. جدول المفضلة مع القيود
CREATE TABLE IF NOT EXISTS student_shortlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  country_id uuid NOT NULL,
  university_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (student_id, country_id, university_id)
);

-- 2. Trigger للحد الأقصى 5
CREATE OR REPLACE FUNCTION trg_enforce_shortlist_max_5()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE 
  cnt int;
BEGIN
  SELECT count(*) INTO cnt
  FROM student_shortlists
  WHERE student_id = NEW.student_id
    AND country_id = NEW.country_id;
    
  IF cnt >= 5 THEN
    RAISE EXCEPTION 'Shortlist limit (5) reached for this country';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_shortlist_max_5 ON student_shortlists;
CREATE TRIGGER enforce_shortlist_max_5
  BEFORE INSERT ON student_shortlists
  FOR EACH ROW EXECUTE FUNCTION trg_enforce_shortlist_max_5();

-- 3. تفعيل RLS
ALTER TABLE student_shortlists ENABLE ROW LEVEL SECURITY;

-- 4. سياسات RLS
DROP POLICY IF EXISTS "Students can view own shortlist" ON student_shortlists;
CREATE POLICY "Students can view own shortlist" ON student_shortlists
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Students can manage own shortlist" ON student_shortlists;
CREATE POLICY "Students can manage own shortlist" ON student_shortlists
  FOR ALL USING (true) WITH CHECK (true);

-- 5. جدول المجالات (subjects)
CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subjects_name_lower ON subjects (lower(name));

-- 6. بيانات تجريبية للمجالات
INSERT INTO subjects (name, slug) VALUES
('التجارة والأعمال', 'business'),
('علوم الحاسوب', 'computer-science'),
('الصحة والطب', 'health'),
('الهندسة', 'engineering'),
('القانون', 'law'),
('الفنون والتصميم', 'arts-design')
ON CONFLICT (slug) DO NOTHING;