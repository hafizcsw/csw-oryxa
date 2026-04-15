-- Add 'unmatched' to match_method check constraint
ALTER TABLE public.university_external_ids DROP CONSTRAINT university_external_ids_match_method_check;
ALTER TABLE public.university_external_ids ADD CONSTRAINT university_external_ids_match_method_check 
  CHECK (match_method = ANY (ARRAY['exact_url','slug','name_city','manual','fuzzy','unmatched']));