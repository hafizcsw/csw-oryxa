ALTER TABLE source_evidence DROP CONSTRAINT source_evidence_field_check;
ALTER TABLE source_evidence ADD CONSTRAINT source_evidence_field_check CHECK (field = ANY (ARRAY[
  'tuition_fee', 'requirements', 'deadline', 'scholarship', 'currency', 'duration',
  'language', 'degree_level', 'admission_requirements', 'entrance_exams', 'required_documents',
  'study_mode', 'budget_places', 'paid_places'
]));