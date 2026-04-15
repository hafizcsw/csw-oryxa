
DO $$
DECLARE
  rec RECORD;
  v_applied int := 0;
  v_skipped int := 0;
  v_url_host text;
  v_existing_host text;
BEGIN
  FOR rec IN
    SELECT r.id, r.university_id, r.official_website_url, r.official_website_domain,
           r.matched_city, r.matched_country, r.enrichment_status, r.confidence_score
    FROM website_enrichment_rows r
    WHERE r.enrichment_status IN ('matched', 'review')
    ORDER BY r.confidence_score DESC NULLS LAST
  LOOP
    BEGIN
      v_url_host := NULL;
      IF rec.official_website_url IS NOT NULL THEN
        BEGIN
          v_url_host := regexp_replace(
            regexp_replace(rec.official_website_url, '^https?://(www\.)?', ''),
            '/.*$', ''
          );
        EXCEPTION WHEN OTHERS THEN
          v_url_host := NULL;
        END;
      END IF;

      -- Check host uniqueness
      IF v_url_host IS NOT NULL THEN
        SELECT website_host INTO v_existing_host
        FROM universities
        WHERE website_host = v_url_host
          AND id != rec.university_id
        LIMIT 1;
        
        IF v_existing_host IS NOT NULL THEN
          -- Only apply city (gap-fill)
          IF rec.matched_city IS NOT NULL THEN
            UPDATE universities
            SET city = COALESCE(city, rec.matched_city), updated_at = now()
            WHERE id = rec.university_id AND city IS NULL;
          END IF;
          
          UPDATE website_enrichment_rows
          SET enrichment_status = 'applied', review_action = 'auto_city_only', reviewed_at = now()
          WHERE id = rec.id;
          v_applied := v_applied + 1;
          CONTINUE;
        END IF;
      END IF;

      -- Apply website (gap-fill) and city (gap-fill)
      UPDATE universities
      SET 
        website = COALESCE(website, rec.official_website_url),
        website_host = COALESCE(website_host, v_url_host),
        city = COALESCE(city, rec.matched_city),
        updated_at = now()
      WHERE id = rec.university_id;

      UPDATE website_enrichment_rows
      SET enrichment_status = 'applied', review_action = 'auto_applied_bulk', reviewed_at = now()
      WHERE id = rec.id;

      v_applied := v_applied + 1;
    EXCEPTION WHEN OTHERS THEN
      v_skipped := v_skipped + 1;
      RAISE NOTICE 'Error for row %: %', rec.id, SQLERRM;
    END;
  END LOOP;

  INSERT INTO pipeline_health_events (pipeline, event_type, details_json)
  VALUES ('website_enrichment', 'bulk_apply_v2', jsonb_build_object(
    'applied', v_applied, 'skipped', v_skipped
  ));

  RAISE NOTICE 'Applied: %, Skipped: %', v_applied, v_skipped;
END;
$$;
