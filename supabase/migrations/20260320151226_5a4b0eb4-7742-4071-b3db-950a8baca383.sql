CREATE OR REPLACE FUNCTION public.rpc_promote_program_brochure_observations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted int := 0;
  v_skipped  int := 0;
  v_total    int := 0;
  rec        record;
BEGIN
  FOR rec IN
    SELECT DISTINCT ON (o.entity_id, urls.url)
      o.id            AS obs_id,
      o.university_id,
      o.entity_id     AS program_id,
      urls.url        AS brochure_url,
      o.source_url    AS source_page_url,
      o.evidence_snippet,
      o.trace_id,
      o.parser_version
    FROM official_site_observations o,
         LATERAL jsonb_array_elements_text(o.value_raw::jsonb) AS urls(url)
    WHERE o.field_name   = 'program_brochure_url'
      AND o.entity_type  = 'program'
      AND o.entity_id    IS NOT NULL
      AND o.university_id IS NOT NULL
      AND o.status       IN ('new', 'verified')
    ORDER BY o.entity_id, urls.url, o.created_at DESC
  LOOP
    v_total := v_total + 1;

    IF EXISTS (
      SELECT 1 FROM university_media
      WHERE program_id  = rec.program_id
        AND source_url  = rec.brochure_url
        AND media_kind  = 'brochure'
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO university_media (
      university_id, program_id, media_kind, source_url,
      source_page_url, alt_text, trace_id, parser_version,
      sort_order, is_primary, created_at, updated_at
    ) VALUES (
      rec.university_id, rec.program_id, 'brochure', rec.brochure_url,
      rec.source_page_url, rec.evidence_snippet, rec.trace_id, rec.parser_version,
      0, false, now(), now()
    );

    v_inserted := v_inserted + 1;

    UPDATE official_site_observations
    SET status = 'promoted'
    WHERE id = rec.obs_id;
  END LOOP;

  RETURN jsonb_build_object(
    'total_candidates', v_total,
    'inserted', v_inserted,
    'skipped_dedup', v_skipped
  );
END;
$$