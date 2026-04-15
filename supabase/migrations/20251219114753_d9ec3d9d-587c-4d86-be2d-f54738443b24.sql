
-- Create junction table for programs <-> subjects (many-to-many)
CREATE TABLE public.program_subjects (
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (program_id, subject_id)
);

-- Enable RLS
ALTER TABLE public.program_subjects ENABLE ROW LEVEL SECURITY;

-- Public read access (programs are public)
CREATE POLICY "program_subjects_public_read"
ON public.program_subjects FOR SELECT
USING (true);

-- Admin write access
CREATE POLICY "program_subjects_admin_write"
ON public.program_subjects FOR ALL
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Create index for faster lookups
CREATE INDEX idx_program_subjects_subject ON public.program_subjects(subject_id);
CREATE INDEX idx_program_subjects_program ON public.program_subjects(program_id);

-- Auto-populate based on program title keywords
INSERT INTO public.program_subjects (program_id, subject_id, is_primary)
SELECT DISTINCT p.id, s.id, true
FROM programs p
CROSS JOIN subjects s
WHERE 
  (s.slug = 'medicine' AND (
    lower(p.title) LIKE '%medicine%' OR lower(p.title) LIKE '%medical%' OR
    lower(p.title) LIKE '%طب%' OR lower(p.title) LIKE '%doctor%' OR
    lower(p.title) LIKE '%physician%' OR lower(p.title) LIKE '%surgery%' OR
    lower(p.title) LIKE '%pharmacy%' OR lower(p.title) LIKE '%صيدل%' OR
    lower(p.title) LIKE '%dentist%' OR lower(p.title) LIKE '%dental%' OR
    lower(p.title) LIKE '%أسنان%' OR lower(p.title) LIKE '%nursing%' OR
    lower(p.title) LIKE '%تمريض%' OR lower(p.title) LIKE '%health%'
  ))
  OR (s.slug = 'engineering' AND (
    lower(p.title) LIKE '%engineer%' OR lower(p.title) LIKE '%هندس%' OR
    lower(p.title) LIKE '%mechanic%' OR lower(p.title) LIKE '%electric%' OR
    lower(p.title) LIKE '%civil%' OR lower(p.title) LIKE '%computer science%' OR
    lower(p.title) LIKE '%software%' OR lower(p.title) LIKE '%برمج%' OR
    lower(p.title) LIKE '%information technology%' OR lower(p.title) LIKE '%IT%'
  ))
  OR (s.slug = 'business' AND (
    lower(p.title) LIKE '%business%' OR lower(p.title) LIKE '%أعمال%' OR
    lower(p.title) LIKE '%management%' OR lower(p.title) LIKE '%إدارة%' OR
    lower(p.title) LIKE '%mba%' OR lower(p.title) LIKE '%marketing%' OR
    lower(p.title) LIKE '%تسويق%' OR lower(p.title) LIKE '%finance%' OR
    lower(p.title) LIKE '%accounting%' OR lower(p.title) LIKE '%محاسب%' OR
    lower(p.title) LIKE '%economics%' OR lower(p.title) LIKE '%اقتصاد%'
  ))
  OR (s.slug = 'arts' AND (
    lower(p.title) LIKE '%art%' OR lower(p.title) LIKE '%فن%' OR
    lower(p.title) LIKE '%design%' OR lower(p.title) LIKE '%تصميم%' OR
    lower(p.title) LIKE '%music%' OR lower(p.title) LIKE '%موسيق%' OR
    lower(p.title) LIKE '%literature%' OR lower(p.title) LIKE '%أدب%' OR
    lower(p.title) LIKE '%media%' OR lower(p.title) LIKE '%إعلام%'
  ))
  OR (s.slug = 'science' AND (
    lower(p.title) LIKE '%science%' OR lower(p.title) LIKE '%علوم%' OR
    lower(p.title) LIKE '%physics%' OR lower(p.title) LIKE '%فيزياء%' OR
    lower(p.title) LIKE '%chemistry%' OR lower(p.title) LIKE '%كيمياء%' OR
    lower(p.title) LIKE '%biology%' OR lower(p.title) LIKE '%أحياء%' OR
    lower(p.title) LIKE '%math%' OR lower(p.title) LIKE '%رياض%'
  ))
  OR (s.slug = 'law' AND (
    lower(p.title) LIKE '%law%' OR lower(p.title) LIKE '%قانون%' OR
    lower(p.title) LIKE '%legal%' OR lower(p.title) LIKE '%حقوق%' OR
    lower(p.title) LIKE '%justice%'
  ))
ON CONFLICT DO NOTHING;
