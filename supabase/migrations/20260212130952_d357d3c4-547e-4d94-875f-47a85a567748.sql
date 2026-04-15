-- Create university_source_evidence table for tracking institutional data extraction
CREATE TABLE IF NOT EXISTS public.university_source_evidence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  source_urls TEXT[] NOT NULL DEFAULT '{}',
  text_snippet TEXT,
  confidence NUMERIC DEFAULT 0.7,
  batch_id UUID,
  extractor TEXT DEFAULT 'gemini-flash-institutional',
  data_extracted JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(university_id, field, batch_id)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_university_source_evidence_uni_id ON public.university_source_evidence(university_id);
CREATE INDEX IF NOT EXISTS idx_university_source_evidence_batch_id ON public.university_source_evidence(batch_id);
CREATE INDEX IF NOT EXISTS idx_university_source_evidence_field ON public.university_source_evidence(field);

-- Create trigger for auto-update of updated_at
CREATE OR REPLACE FUNCTION public.update_university_source_evidence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_update_university_source_evidence_updated_at ON public.university_source_evidence;

CREATE TRIGGER trigger_update_university_source_evidence_updated_at
BEFORE UPDATE ON public.university_source_evidence
FOR EACH ROW
EXECUTE FUNCTION public.update_university_source_evidence_updated_at();