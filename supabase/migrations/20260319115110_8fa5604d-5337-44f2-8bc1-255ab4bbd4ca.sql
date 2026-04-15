
-- One-time proof: republish draft 15829 → program 4fef7595 using same logic as patched rpc_publish_programs
UPDATE programs
SET apply_url = COALESCE(
  (SELECT extracted_json->>'apply_url' FROM program_draft WHERE id = 15829),
  (SELECT extracted_json->>'detail_url' FROM program_draft WHERE id = 15829),
  (SELECT source_program_url FROM program_draft WHERE id = 15829)
),
ielts_required = COALESCE(
  ((SELECT extracted_json->>'ielts_min' FROM program_draft WHERE id = 15829))::numeric,
  ielts_required
),
duolingo_min = COALESCE(
  ((SELECT extracted_json->>'duolingo_min' FROM program_draft WHERE id = 15829))::numeric,
  duolingo_min
),
pte_min = COALESCE(
  ((SELECT extracted_json->>'pte_min' FROM program_draft WHERE id = 15829))::numeric,
  pte_min
),
cefr_level = COALESCE(
  (SELECT extracted_json->>'cefr_level' FROM program_draft WHERE id = 15829),
  cefr_level
),
updated_at = now()
WHERE id = '4fef7595-0744-46db-9891-8e7a19ae7fd0';
