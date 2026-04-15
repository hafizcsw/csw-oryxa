-- Create tables for bulk analysis results
CREATE TABLE IF NOT EXISTS public.unis_assistant_reviews (
  id            BIGSERIAL PRIMARY KEY,
  university_id UUID NOT NULL,
  country_iso   TEXT,
  stats         JSONB,
  decision      TEXT,
  confidence    NUMERIC,
  reasons       JSONB,
  warnings      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unis_reviews_uni ON public.unis_assistant_reviews(university_id);
CREATE INDEX IF NOT EXISTS idx_unis_reviews_decision ON public.unis_assistant_reviews(decision);

CREATE TABLE IF NOT EXISTS public.unis_assistant_review_items (
  id           BIGSERIAL PRIMARY KEY,
  review_id    BIGINT REFERENCES public.unis_assistant_reviews(id) ON DELETE CASCADE,
  program_id   UUID,
  issues       TEXT[],
  diff         JSONB
);

CREATE INDEX IF NOT EXISTS idx_unis_items_review ON public.unis_assistant_review_items(review_id);

-- Enable RLS
ALTER TABLE public.unis_assistant_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unis_assistant_review_items ENABLE ROW LEVEL SECURITY;

-- Admin policies
DROP POLICY IF EXISTS admin_rw_reviews ON public.unis_assistant_reviews;
CREATE POLICY admin_rw_reviews ON public.unis_assistant_reviews
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_app_meta_data->>'is_admin')::boolean = true
    )
  );

DROP POLICY IF EXISTS admin_rw_items ON public.unis_assistant_review_items;
CREATE POLICY admin_rw_items ON public.unis_assistant_review_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_app_meta_data->>'is_admin')::boolean = true
    )
  );