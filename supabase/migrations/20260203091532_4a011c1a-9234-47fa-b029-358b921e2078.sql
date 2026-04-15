-- Make job_id nullable for order-level events
ALTER TABLE public.notarized_translation_events
ALTER COLUMN job_id DROP NOT NULL;