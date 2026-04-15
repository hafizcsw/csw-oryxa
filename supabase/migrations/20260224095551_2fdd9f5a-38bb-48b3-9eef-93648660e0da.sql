-- Mark all 123 already-enriched universities as phase1 done
UPDATE public.university_external_ids
SET phases_done = array_append(COALESCE(phases_done, '{}'), 'phase1')
WHERE source_name = 'studyinrussia' 
  AND university_id IS NOT NULL 
  AND last_seen_at > '2026-02-24'
  AND NOT ('phase1' = ANY(COALESCE(phases_done, '{}')));