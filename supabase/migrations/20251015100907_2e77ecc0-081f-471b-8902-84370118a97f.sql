-- Create universities table
CREATE TABLE public.universities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  country_id UUID REFERENCES public.countries(id),
  city TEXT,
  annual_fees NUMERIC,
  monthly_living NUMERIC,
  ranking INTEGER,
  website TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create programs table
CREATE TABLE public.programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  degree_id UUID REFERENCES public.degrees(id),
  description TEXT,
  languages TEXT[] DEFAULT ARRAY['EN'],
  next_intake TEXT,
  accepted_certificates TEXT[],
  duration_months INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Universities are publicly readable"
  ON public.universities FOR SELECT
  USING (is_active = true);

CREATE POLICY "Programs are publicly readable"
  ON public.programs FOR SELECT
  USING (is_active = true);

-- Create view for search
CREATE OR REPLACE VIEW programs_view AS
SELECT
  p.id as program_id,
  p.title,
  d.slug as degree_slug,
  u.id as university_id,
  u.name as university_name,
  c.slug as country_slug,
  u.city,
  u.annual_fees,
  u.monthly_living,
  p.languages,
  p.next_intake,
  u.ranking,
  p.accepted_certificates,
  p.description
FROM programs p
JOIN universities u ON u.id = p.university_id
LEFT JOIN degrees d ON d.id = p.degree_id
LEFT JOIN countries c ON c.id = u.country_id
WHERE p.is_active = true AND u.is_active = true;

-- Create indexes for performance
CREATE INDEX idx_u_name ON universities USING gin (to_tsvector('simple', coalesce(name,'')));
CREATE INDEX idx_p_title ON programs USING gin (to_tsvector('simple', coalesce(title,'')));
CREATE INDEX idx_u_fees ON universities (annual_fees);
CREATE INDEX idx_u_living ON universities (monthly_living);
CREATE INDEX idx_u_country ON universities (country_id);
CREATE INDEX idx_p_degree ON programs (degree_id);
CREATE INDEX idx_p_certs ON programs USING gin (accepted_certificates);
CREATE INDEX idx_u_rank ON universities (ranking);
CREATE INDEX idx_p_langs ON programs USING gin (languages);