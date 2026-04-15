-- ADD MISSING COLUMNS FOR CONTRACT LOCK

-- 1) Add to quotes table
ALTER TABLE public.notarized_translation_quotes
ADD COLUMN IF NOT EXISTS schema_version INT NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS pricing_snapshot_json JSONB;

-- 2) Add to jobs table  
ALTER TABLE public.notarized_translation_jobs
ADD COLUMN IF NOT EXISTS page_count_locked BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS page_count_locked_at TIMESTAMPTZ;

-- 3) Cleanup duplicate rpc_notarized_job_set_precheck (without page_count param)
DROP FUNCTION IF EXISTS public.rpc_notarized_job_set_precheck(uuid, boolean, numeric, text[], text, numeric, text, text[], text[]);