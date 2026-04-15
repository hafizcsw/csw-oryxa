
CREATE OR REPLACE FUNCTION tmp_publish_pending_d4() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
  cnt INT := 0;
BEGIN
  FOR r IN 
    SELECT d.id as draft_id, d.university_id, d.proposed_value, d.confidence
    FROM university_enrichment_draft d
    WHERE d.status = 'pending' AND d.field_name = 'website' AND d.proposed_value IS NOT NULL
    LIMIT 500
  LOOP
    BEGIN
      UPDATE universities SET website = r.proposed_value, website_source = 'firecrawl_search',
        website_confidence = r.confidence, website_resolved_at = now()
      WHERE id = r.university_id AND website IS NULL;
      UPDATE university_enrichment_draft SET status = 'published', finalized_at = now() WHERE id = r.draft_id;
      cnt := cnt + 1;
    EXCEPTION WHEN unique_violation THEN
      UPDATE university_enrichment_draft SET status = 'conflict', reject_reason = 'host_dup', finalized_at = now() WHERE id = r.draft_id;
    END;
  END LOOP;
  RETURN cnt;
END $$;
