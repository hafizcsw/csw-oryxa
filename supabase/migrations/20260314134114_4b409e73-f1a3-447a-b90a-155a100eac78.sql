
CREATE TABLE IF NOT EXISTS public.city_backfill_csv (
  id serial PRIMARY KEY,
  university_name text NOT NULL,
  country_name text,
  city text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_city_backfill_csv_name ON public.city_backfill_csv(university_name);
