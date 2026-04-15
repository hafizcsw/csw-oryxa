CREATE TABLE IF NOT EXISTS public.temp_website_import (
  id serial PRIMARY KEY,
  name text NOT NULL,
  website text NOT NULL
);
