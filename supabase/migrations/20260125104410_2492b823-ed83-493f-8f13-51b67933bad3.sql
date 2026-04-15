-- STEP 1: Create disciplines reference table
CREATE TABLE IF NOT EXISTS public.disciplines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  aliases_ar TEXT[] DEFAULT '{}',
  aliases_en TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.disciplines ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Disciplines are publicly readable"
  ON public.disciplines FOR SELECT
  USING (true);

-- Admin write access  
CREATE POLICY "Admins can manage disciplines"
  ON public.disciplines FOR ALL
  USING (public.check_is_admin(auth.uid()));

-- Seed common disciplines with Arabic aliases
INSERT INTO public.disciplines (slug, name_ar, name_en, aliases_ar, aliases_en) VALUES
  ('medicine', 'الطب', 'Medicine', ARRAY['طب', 'طبي', 'الطب البشري', 'كلية الطب'], ARRAY['medical', 'med', 'doctor', 'physician']),
  ('engineering', 'الهندسة', 'Engineering', ARRAY['هندسة', 'هندسي', 'مهندس'], ARRAY['eng', 'engineer']),
  ('business', 'إدارة الأعمال', 'Business Administration', ARRAY['إدارة', 'أعمال', 'تجارة', 'اقتصاد', 'محاسبة'], ARRAY['bba', 'mba', 'management', 'commerce', 'accounting']),
  ('computer_science', 'علوم الحاسب', 'Computer Science', ARRAY['حاسب', 'برمجة', 'تقنية المعلومات', 'حاسوب'], ARRAY['cs', 'it', 'programming', 'software', 'computing']),
  ('law', 'القانون', 'Law', ARRAY['قانون', 'قانوني', 'حقوق', 'شريعة'], ARRAY['legal', 'jurisprudence']),
  ('pharmacy', 'الصيدلة', 'Pharmacy', ARRAY['صيدلة', 'صيدلي', 'دواء'], ARRAY['pharma', 'pharmaceutical']),
  ('dentistry', 'طب الأسنان', 'Dentistry', ARRAY['أسنان', 'طب أسنان'], ARRAY['dental']),
  ('nursing', 'التمريض', 'Nursing', ARRAY['تمريض', 'ممرض'], ARRAY['nurse']),
  ('architecture', 'العمارة', 'Architecture', ARRAY['عمارة', 'معماري', 'تصميم معماري'], ARRAY['arch']),
  ('arts', 'الفنون', 'Arts', ARRAY['فنون', 'فن', 'أدب'], ARRAY['art', 'humanities', 'liberal arts']),
  ('science', 'العلوم', 'Science', ARRAY['علوم', 'علمي'], ARRAY['sciences', 'natural science']),
  ('education', 'التربية', 'Education', ARRAY['تربية', 'تعليم', 'معلم'], ARRAY['teaching', 'pedagogy'])
ON CONFLICT (slug) DO NOTHING;

-- Create index
CREATE INDEX IF NOT EXISTS idx_disciplines_slug ON public.disciplines(slug);