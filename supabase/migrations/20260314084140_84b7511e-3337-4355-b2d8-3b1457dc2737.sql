
CREATE TABLE public.university_geo_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id text NOT NULL,
  provider text NOT NULL DEFAULT 'osm_overpass',
  city_name text NOT NULL,
  country_code text NOT NULL,
  osm_type text,
  osm_id bigint,
  matched_name text,
  lat double precision,
  lon double precision,
  match_confidence double precision,
  match_status text NOT NULL DEFAULT 'unmatched',
  query_version text DEFAULT 'v1',
  raw_json jsonb,
  resolved_at timestamptz DEFAULT now(),
  UNIQUE(provider, university_id, city_name, country_code)
);

ALTER TABLE public.university_geo_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on university_geo_matches"
  ON public.university_geo_matches
  FOR SELECT
  USING (true);

CREATE POLICY "Allow service role insert/update on university_geo_matches"
  ON public.university_geo_matches
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_ugm_city_country ON public.university_geo_matches (city_name, country_code, provider);
CREATE INDEX idx_ugm_university ON public.university_geo_matches (university_id);
