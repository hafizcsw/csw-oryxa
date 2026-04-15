
CREATE TABLE public.university_duplicates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  duplicate_university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  canonical_university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'merge_candidate',
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(duplicate_university_id, canonical_university_id)
);

ALTER TABLE public.university_duplicates ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.university_duplicates IS 'Tracks duplicate university rows linked to their canonical owner. Rows here are excluded from future enrichment/apply jobs.';
