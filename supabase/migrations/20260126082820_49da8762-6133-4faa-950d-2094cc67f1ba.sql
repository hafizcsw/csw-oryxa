-- P1.4: Translation Jobs Queue
CREATE TABLE IF NOT EXISTS public.translation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('program', 'university')),
  entity_id uuid NOT NULL,
  target_lang text NOT NULL,
  source_lang text NOT NULL DEFAULT 'en',
  source_text text NOT NULL,
  field_name text NOT NULL CHECK (field_name IN ('name', 'description')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'error')),
  priority int NOT NULL DEFAULT 50,
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (entity_type, entity_id, target_lang, field_name)
);

-- Index for worker polling
CREATE INDEX IF NOT EXISTS idx_translation_jobs_pending 
  ON public.translation_jobs (status, priority DESC, created_at ASC) 
  WHERE status = 'pending';

-- Index for deduplication check
CREATE INDEX IF NOT EXISTS idx_translation_jobs_lookup 
  ON public.translation_jobs (entity_type, entity_id, target_lang);

-- RLS: Admin only for now
ALTER TABLE public.translation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage translation jobs"
  ON public.translation_jobs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- P0.5: FX Rates History (additive, keeps fx_rates intact)
CREATE TABLE IF NOT EXISTS public.fx_rates_history (
  currency_code text NOT NULL,
  rate_to_usd numeric NOT NULL,
  as_of_date date NOT NULL,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (currency_code, as_of_date)
);

-- RLS for fx_rates_history
ALTER TABLE public.fx_rates_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read FX history"
  ON public.fx_rates_history FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admin can write FX history"
  ON public.fx_rates_history FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- View for latest rates (preferred over raw table)
CREATE OR REPLACE VIEW public.fx_rates_latest AS
SELECT DISTINCT ON (currency_code)
  currency_code,
  rate_to_usd,
  as_of_date,
  source,
  created_at
FROM public.fx_rates_history
ORDER BY currency_code, as_of_date DESC;