
-- Add unique constraint for Door5 upsert on university_housing
CREATE UNIQUE INDEX IF NOT EXISTS uq_university_housing_source
  ON public.university_housing (university_id, source_name, housing_type);

-- Add unique constraint for provenance upsert
CREATE UNIQUE INDEX IF NOT EXISTS uq_field_provenance_source
  ON public.university_field_provenance (university_id, field_name, source_name);
