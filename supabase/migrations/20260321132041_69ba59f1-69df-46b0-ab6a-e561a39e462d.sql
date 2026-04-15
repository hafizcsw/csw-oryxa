
DO $$
DECLARE
  rec RECORD;
  v_applied int := 0;
  v_skipped int := 0;
  v_dup int := 0;
  v_err text;
BEGIN
  FOR rec IN
    SELECT r.id, r.university_id, r.official_website_url, r.matched_city,
           r.enrichment_status, r.confidence_score
    FROM website_enrichment_rows r
    WHERE r.enrichment_status IN ('matched', 'review')
    ORDER BY r.confidence_score DESC NULLS LAST
  LOOP
    BEGIN
      -- Try to update with website
      IF rec.official_website_url IS NOT NULL THEN
        UPDATE universities
        SET 
          website = COALESCE(universities.website, rec.official_website_url),
          city = COALESCE(universities.city, rec.matched_city)
        WHERE id = rec.university_id;
      ELSE
        -- No URL, just city
        IF rec.matched_city IS NOT NULL THEN
          UPDATE universities
          SET city = COALESCE(universities.city, rec.matched_city)
          WHERE id = rec.university_id;
        END IF;
      END IF;

      UPDATE website_enrichment_rows
      SET enrichment_status = 'applied', review_action = 'auto_bulk_v3', reviewed_at = now()
      WHERE id = rec.id;

      v_applied := v_applied + 1;
    EXCEPTION 
      WHEN unique_violation THEN
        -- Duplicate website_host or website_etld1, apply city only
        BEGIN
          IF rec.matched_city IS NOT NULL THEN
            UPDATE universities
            SET city = COALESCE(universities.city, rec.matched_city)
            WHERE id = rec.university_id;
          END IF;
          UPDATE website_enrichment_rows
          SET enrichment_status = 'applied', review_action = 'city_only_dup_host', reviewed_at = now()
          WHERE id = rec.id;
          v_dup := v_dup + 1;
        EXCEPTION WHEN OTHERS THEN
          v_skipped := v_skipped + 1;
        END;
      WHEN OTHERS THEN
        v_skipped := v_skipped + 1;
    END;
  END LOOP;

  INSERT INTO pipeline_health_events (pipeline, event_type, details_json)
  VALUES ('website_enrichment', 'bulk_apply_v3', jsonb_build_object(
    'applied', v_applied, 'dup_host_city_only', v_dup, 'skipped', v_skipped
  ));
END;
$$;
