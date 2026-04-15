-- Add unique constraint for upsert on university_external_ids
ALTER TABLE public.university_external_ids 
  ADD CONSTRAINT uq_ext_ids_source_external UNIQUE (source_name, external_id);
