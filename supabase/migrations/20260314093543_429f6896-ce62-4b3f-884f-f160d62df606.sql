CREATE TABLE IF NOT EXISTS public.spreadsheet_enrichment_staging (
  id serial PRIMARY KEY,
  name_en text NOT NULL,
  country_code text,
  city text,
  official_website text,
  map_location text,
  resolution_status text,
  applied boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);