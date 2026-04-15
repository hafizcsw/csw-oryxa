-- Replace enrichment_status with phases_done array for multi-phase tracking
ALTER TABLE public.university_external_ids 
ADD COLUMN IF NOT EXISTS phases_done text[] DEFAULT '{}';