
DO $$
DECLARE
  rec RECORD;
  v_applied int := 0;
  v_skipped int := 0;
BEGIN
  FOR rec IN
    SELECT r.id, r.university_id, r.official_website_url, r.matched_city,
           r.enrichment_status, r.confidence_score
    FROM website_enrichment_rows r
    WHERE r.enrichment_status IN ('matched', 'review')
    ORDER BY r.confidence_score DESC NULLS LAST
  LOOP
    BEGIN
      UPDATE universities
      SET 
        website = COALESCE(universities.website, rec.official_website_url),
        city = COALESCE(universities.city, rec.matched_city)
      WHERE id = rec.university_id;

      UPDATE website_enrichment_rows
      SET enrichment_status = 'applied', review_action = 'auto_applied_bulk', reviewed_at = now()
      WHERE id = rec.id;

      v_applied := v_applied + 1;
    EXCEPTION WHEN OTHERS THEN
      v_skipped := v_skipped + 1;
    END;
  END LOOP;

  RAISE NOTICE 'Applied: %, Skipped: %', v_applied, v_skipped;
END;
$$;
