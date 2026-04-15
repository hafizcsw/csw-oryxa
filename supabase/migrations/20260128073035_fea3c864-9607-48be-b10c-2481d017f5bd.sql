
-- CLEANUP: Remove duplicate publish gate triggers, keep only V3
-- V3 already includes all V1 and V2 checks

DROP TRIGGER IF EXISTS enforce_program_publish_requirements ON public.programs;
DROP TRIGGER IF EXISTS trg_program_publish_gate ON public.programs;
DROP TRIGGER IF EXISTS trg_program_publish_gate_v2 ON public.programs;
DROP TRIGGER IF EXISTS trg_enforce_program_publish_v2 ON public.programs;

-- Keep only V3
-- trg_enforce_program_publish_v3 stays

-- Verify remaining triggers
SELECT tgname FROM pg_trigger 
WHERE tgrelid = 'public.programs'::regclass 
AND NOT tgisinternal
AND tgname LIKE '%publish%';
