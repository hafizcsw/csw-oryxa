-- Create function for updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_staging_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create staging table for university imports from external sources
CREATE TABLE public.university_import_staging (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  name_en TEXT,
  country_name TEXT,
  country_code TEXT,
  city TEXT,
  rank INTEGER,
  score NUMERIC,
  website_url TEXT,
  logo_url TEXT,
  is_verified BOOLEAN DEFAULT false,
  tier TEXT,
  raw_data JSONB,
  imported_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  matched_university_id UUID,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT uq_staging_source_external_id UNIQUE (source, external_id)
);

-- Create indexes
CREATE INDEX idx_staging_source ON public.university_import_staging(source);
CREATE INDEX idx_staging_status ON public.university_import_staging(status);
CREATE INDEX idx_staging_country ON public.university_import_staging(country_name);

-- Enable RLS
ALTER TABLE public.university_import_staging ENABLE ROW LEVEL SECURITY;

-- Only admins can access this table
CREATE POLICY "Admins can manage staging data"
ON public.university_import_staging
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_university_import_staging_updated_at
BEFORE UPDATE ON public.university_import_staging
FOR EACH ROW
EXECUTE FUNCTION public.handle_staging_updated_at();