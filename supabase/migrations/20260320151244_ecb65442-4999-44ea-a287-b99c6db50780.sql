DELETE FROM university_media 
WHERE media_kind = 'brochure' 
  AND program_id IS NOT NULL 
  AND trace_id = 'BROCHURE-LINKAGE-V1'