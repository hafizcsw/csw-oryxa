-- Add enrichment_status to track which universities have been enriched
ALTER TABLE public.university_external_ids 
ADD COLUMN IF NOT EXISTS enrichment_status text DEFAULT 'pending';

-- Index for fast lookup of pending universities
CREATE INDEX IF NOT EXISTS idx_uei_enrichment_pending 
ON public.university_external_ids (source_name, enrichment_status) 
WHERE enrichment_status = 'pending' AND university_id IS NOT NULL;