-- Add university housing fields
ALTER TABLE public.universities
ADD COLUMN IF NOT EXISTS has_dorm boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS dorm_price_monthly_local numeric,
ADD COLUMN IF NOT EXISTS dorm_currency_code text;

-- Add comment for clarity
COMMENT ON COLUMN public.universities.has_dorm IS 'Whether the university offers on-campus dormitory/housing';
COMMENT ON COLUMN public.universities.dorm_price_monthly_local IS 'Monthly dormitory cost in local currency';
COMMENT ON COLUMN public.universities.dorm_currency_code IS 'Currency code for dormitory pricing (e.g., USD, EUR)';