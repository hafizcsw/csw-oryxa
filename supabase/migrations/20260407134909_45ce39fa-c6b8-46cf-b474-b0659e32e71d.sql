
-- Service regions table
CREATE TABLE public.service_regions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_key TEXT NOT NULL,
  country_codes TEXT[] NOT NULL DEFAULT '{}',
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.service_regions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active regions"
  ON public.service_regions FOR SELECT
  USING (is_active = true);

-- Paid services table
CREATE TABLE public.paid_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  region_id UUID NOT NULL REFERENCES public.service_regions(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('language_course', 'student_service', 'admission', 'bundle')),
  name_key TEXT NOT NULL,
  description_key TEXT NOT NULL DEFAULT '',
  tier TEXT,
  price_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency_override TEXT,
  features JSONB NOT NULL DEFAULT '[]',
  is_popular BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.paid_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active services"
  ON public.paid_services FOR SELECT
  USING (is_active = true);

-- Index for fast region lookups
CREATE INDEX idx_paid_services_region ON public.paid_services(region_id);
CREATE INDEX idx_paid_services_category ON public.paid_services(category);
