
ALTER TABLE public.university_external_ids 
DROP CONSTRAINT university_external_ids_match_method_check;

ALTER TABLE public.university_external_ids 
ADD CONSTRAINT university_external_ids_match_method_check 
CHECK (match_method = ANY (ARRAY['exact_url','slug','name_city','name_exact','name_stripped','existing_map','manual','fuzzy','unmatched','alias_exact','alias_stripped','name_contains']));
