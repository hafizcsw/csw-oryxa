-- Country aliases table for mapping external names to our countries
CREATE TABLE public.country_aliases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_id uuid NOT NULL REFERENCES public.countries(id),
  alias_normalized text NOT NULL,
  source text DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_country_aliases_unique ON public.country_aliases (alias_normalized);
CREATE INDEX idx_country_aliases_country_id ON public.country_aliases (country_id);

ALTER TABLE public.country_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Country aliases readable by everyone"
  ON public.country_aliases FOR SELECT USING (true);

CREATE POLICY "Only admins can modify country aliases"
  ON public.country_aliases FOR ALL
  USING (public.is_admin(auth.uid()));