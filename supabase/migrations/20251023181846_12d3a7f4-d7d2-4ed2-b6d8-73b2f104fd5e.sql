-- Add missing columns to existing scholarships table
ALTER TABLE public.scholarships 
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS currency_code TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS coverage_type TEXT,
  ADD COLUMN IF NOT EXISTS application_url TEXT,
  ADD COLUMN IF NOT EXISTS degree_level TEXT,
  ADD COLUMN IF NOT EXISTS harvested_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Ensure RLS is enabled
ALTER TABLE public.scholarships ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "scholarships_public_read" ON public.scholarships;
DROP POLICY IF EXISTS "scholarships_admin_all" ON public.scholarships;

-- Create RLS policies
CREATE POLICY "scholarships_public_read"
  ON public.scholarships
  FOR SELECT
  USING (status = 'published');

CREATE POLICY "scholarships_admin_all"
  ON public.scholarships
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Create indexes if not exist
CREATE INDEX IF NOT EXISTS idx_scholarships_university ON public.scholarships(university_id);
CREATE INDEX IF NOT EXISTS idx_scholarships_status ON public.scholarships(status);
CREATE INDEX IF NOT EXISTS idx_scholarships_deadline ON public.scholarships(deadline);

-- Create view for public scholarships
CREATE OR REPLACE VIEW public.vw_scholarships_public AS
SELECT 
  s.id,
  s.university_id,
  u.name as university_name,
  u.logo_url as university_logo,
  s.title,
  s.description,
  s.amount,
  s.currency_code,
  s.coverage_type,
  s.eligibility,
  s.deadline,
  s.application_url,
  s.degree_level,
  s.published_at,
  CASE 
    WHEN s.deadline IS NOT NULL AND s.deadline < CURRENT_DATE THEN 'expired'
    WHEN s.deadline IS NOT NULL AND s.deadline < CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
    ELSE 'active'
  END as deadline_status
FROM public.scholarships s
JOIN public.universities u ON u.id = s.university_id
WHERE s.status = 'published'
ORDER BY s.deadline ASC NULLS LAST, s.published_at DESC;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_scholarships_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS scholarships_updated_at ON public.scholarships;
CREATE TRIGGER scholarships_updated_at
  BEFORE UPDATE ON public.scholarships
  FOR EACH ROW
  EXECUTE FUNCTION public.update_scholarships_updated_at();