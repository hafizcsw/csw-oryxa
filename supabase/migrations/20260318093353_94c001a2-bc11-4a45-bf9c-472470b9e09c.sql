
-- Institution Claims table
CREATE TABLE public.institution_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  institution_id UUID,
  institution_name TEXT NOT NULL,
  official_email TEXT NOT NULL,
  website TEXT,
  country TEXT,
  city TEXT,
  job_title TEXT,
  department TEXT,
  evidence_paths JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  claim_type TEXT NOT NULL DEFAULT 'claim_existing',
  status TEXT NOT NULL DEFAULT 'draft',
  role TEXT DEFAULT 'owner',
  allowed_modules JSONB DEFAULT '[]'::jsonb,
  reviewer_notes TEXT,
  missing_items JSONB DEFAULT '[]'::jsonb,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.institution_claims ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own claims
CREATE POLICY "Users can read own claims"
  ON public.institution_claims
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Users can insert their own claims
CREATE POLICY "Users can insert own claims"
  ON public.institution_claims
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own claims (limited fields)
CREATE POLICY "Users can update own claims"
  ON public.institution_claims
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Auto-set submitted_at when status changes to submitted
CREATE OR REPLACE FUNCTION public.set_claim_submitted_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status != 'submitted') THEN
    NEW.submitted_at = now();
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_claim_submitted_at
  BEFORE INSERT OR UPDATE ON public.institution_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.set_claim_submitted_at();
