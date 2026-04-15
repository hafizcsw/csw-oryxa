
-- Add lat/lon + source columns to university_housing for geo readiness
ALTER TABLE public.university_housing
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lon double precision,
  ADD COLUMN IF NOT EXISTS geo_source text,
  ADD COLUMN IF NOT EXISTS address text;

-- Ensure rate_limits has a unique constraint on (domain, endpoint) for upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rate_limits_domain_endpoint_key'
  ) THEN
    ALTER TABLE public.rate_limits ADD CONSTRAINT rate_limits_domain_endpoint_key UNIQUE (domain, endpoint);
  END IF;
END $$;
