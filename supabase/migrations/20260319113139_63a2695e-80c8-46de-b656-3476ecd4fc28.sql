-- Priority 1: Program-level model gaps
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS apply_url text,
  ADD COLUMN IF NOT EXISTS duolingo_min numeric,
  ADD COLUMN IF NOT EXISTS pte_min numeric,
  ADD COLUMN IF NOT EXISTS cefr_level text;

COMMENT ON COLUMN public.programs.apply_url IS 'Direct application/CTA URL for this specific program';
COMMENT ON COLUMN public.programs.duolingo_min IS 'Minimum Duolingo English Test score required';
COMMENT ON COLUMN public.programs.pte_min IS 'Minimum PTE Academic score required';
COMMENT ON COLUMN public.programs.cefr_level IS 'Minimum CEFR level required (A1-C2)';