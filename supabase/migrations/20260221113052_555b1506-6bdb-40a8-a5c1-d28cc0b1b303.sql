-- P2.6: Add missing university metadata columns
ALTER TABLE public.universities
  ADD COLUMN IF NOT EXISTS enrolled_students integer,
  ADD COLUMN IF NOT EXISTS acceptance_rate numeric,
  ADD COLUMN IF NOT EXISTS university_type text;

-- Guard: acceptance_rate must be 0-100
CREATE OR REPLACE FUNCTION public.validate_acceptance_rate()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.acceptance_rate IS NOT NULL AND (NEW.acceptance_rate < 0 OR NEW.acceptance_rate > 100) THEN
    NEW.acceptance_rate := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_validate_acceptance_rate ON public.universities;
CREATE TRIGGER trg_validate_acceptance_rate
  BEFORE INSERT OR UPDATE ON public.universities
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_acceptance_rate();

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS idx_universities_enrolled_students ON public.universities (enrolled_students) WHERE enrolled_students IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_universities_acceptance_rate ON public.universities (acceptance_rate) WHERE acceptance_rate IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_universities_university_type ON public.universities (university_type) WHERE university_type IS NOT NULL;