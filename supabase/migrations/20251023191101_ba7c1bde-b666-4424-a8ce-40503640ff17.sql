-- Create price_observations table for harvest system
CREATE TABLE IF NOT EXISTS public.price_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE,
  degree_level TEXT,
  audience TEXT DEFAULT 'international',
  amount NUMERIC,
  currency TEXT,
  amount_usd NUMERIC,
  academic_year TEXT,
  source_url TEXT,
  source_id UUID,
  is_official BOOLEAN DEFAULT false,
  confidence NUMERIC DEFAULT 0.5,
  observed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_price_obs_university ON public.price_observations(university_id);
CREATE INDEX IF NOT EXISTS idx_price_obs_program ON public.price_observations(program_id);
CREATE INDEX IF NOT EXISTS idx_price_obs_observed_at ON public.price_observations(observed_at);

-- Enable RLS
ALTER TABLE public.price_observations ENABLE ROW LEVEL SECURITY;

-- Policy for admins to manage observations
CREATE POLICY "admin_price_obs_all" ON public.price_observations
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Create logos and reports storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true), ('reports', 'reports', true)
ON CONFLICT (id) DO NOTHING;