
-- CRITICAL FIX: Add unique constraint on job_id to prevent duplicate queue entries
-- This is essential for idempotency - without it, ON CONFLICT DO NOTHING has no effect

-- Add unique constraint on job_id
ALTER TABLE public.notarized_translation_queue 
ADD CONSTRAINT notarized_translation_queue_job_id_unique UNIQUE (job_id);

-- Comment for documentation
COMMENT ON CONSTRAINT notarized_translation_queue_job_id_unique ON public.notarized_translation_queue 
IS 'Ensures each job can only be in queue once - critical for idempotent enqueue';
