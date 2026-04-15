
-- Mapping table: university <-> HumHub space
CREATE TABLE public.university_humhub_spaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  university_id TEXT NOT NULL UNIQUE,
  humhub_space_id INTEGER NOT NULL,
  humhub_space_guid TEXT,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_uhs_university ON public.university_humhub_spaces(university_id);
CREATE INDEX idx_uhs_space ON public.university_humhub_spaces(humhub_space_id);

ALTER TABLE public.university_humhub_spaces ENABLE ROW LEVEL SECURITY;

-- Only super-admins can manage mappings (via edge function with service role)
-- No public read needed since data flows through proxy
CREATE POLICY "Service role only"
  ON public.university_humhub_spaces
  FOR ALL
  USING (false)
  WITH CHECK (false);
