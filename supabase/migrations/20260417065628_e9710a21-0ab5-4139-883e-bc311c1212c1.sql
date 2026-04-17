CREATE TABLE IF NOT EXISTS public.city_import_staging (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  city TEXT NOT NULL,
  matched_university_id UUID,
  applied BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.city_import_staging ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin only city_import_staging" ON public.city_import_staging FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS idx_city_import_staging_lookup ON public.city_import_staging (lower(name), lower(country));