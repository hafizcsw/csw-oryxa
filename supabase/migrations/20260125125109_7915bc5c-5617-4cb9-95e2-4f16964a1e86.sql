-- 0) Normalize existing data to 0/1/NULL (idempotent)
UPDATE public.programs
SET ielts_required =
  CASE
    WHEN ielts_required IS NULL THEN NULL
    WHEN ielts_required > 0 THEN 1
    ELSE 0
  END
WHERE ielts_required IS NOT NULL AND ielts_required NOT IN (0,1);

UPDATE public.programs
SET gpa_required =
  CASE
    WHEN gpa_required IS NULL THEN NULL
    WHEN gpa_required > 0 THEN 1
    ELSE 0
  END
WHERE gpa_required IS NOT NULL AND gpa_required NOT IN (0,1);

-- 1) Add CHECK constraints (NOT VALID first to avoid heavy locking)
ALTER TABLE public.programs
  ADD CONSTRAINT programs_ielts_required_01_chk
  CHECK (ielts_required IS NULL OR ielts_required IN (0,1)) NOT VALID;

ALTER TABLE public.programs
  ADD CONSTRAINT programs_gpa_required_01_chk
  CHECK (gpa_required IS NULL OR gpa_required IN (0,1)) NOT VALID;

-- 2) Validate (will scan table once)
ALTER TABLE public.programs VALIDATE CONSTRAINT programs_ielts_required_01_chk;
ALTER TABLE public.programs VALIDATE CONSTRAINT programs_gpa_required_01_chk;