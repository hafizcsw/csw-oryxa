
CREATE OR REPLACE FUNCTION rpc_promote_file_fee_observations_to_draft(
  _university_id uuid DEFAULT NULL,
  _dry_run boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promoted_uni int := 0;
  v_promoted_prog int := 0;
  v_skipped int := 0;
  v_review_only int := 0;
  rec record;
BEGIN
  FOR rec IN
    SELECT 
      o.university_id,
      o.entity_type,
      o.entity_id,
      array_agg(o.id ORDER BY o.confidence DESC) AS obs_ids,
      count(*) AS obs_count
    FROM official_site_observations o
    WHERE o.source_type = 'official_pdf'
      AND o.fact_group = 'fees'
      AND o.field_name = 'tuition_fees'
      AND o.status = 'new'
      AND (_university_id IS NULL OR o.university_id = _university_id)
    GROUP BY o.university_id, o.entity_type, o.entity_id
  LOOP
    DECLARE
      v_fields jsonb := '{}'::jsonb;
      v_evidence jsonb := '{}'::jsonb;
      v_draft_key text;
      v_uni_name text;
      v_schema_ver text := 'osc_file_fees_v1';
      obs_rec record;
      v_fee_count int := 0;
      v_source_url text;
    BEGIN
      FOR obs_rec IN
        SELECT DISTINCT ON (o.value_raw)
          o.id AS obs_id,
          o.value_raw,
          o.value_normalized,
          o.currency,
          o.billing_period,
          o.confidence,
          o.evidence_snippet,
          o.source_url,
          o.page_title,
          o.parser_version
        FROM official_site_observations o
        WHERE o.id = ANY(rec.obs_ids)
        ORDER BY o.value_raw, o.confidence DESC
      LOOP
        v_fee_count := v_fee_count + 1;
        IF v_source_url IS NULL THEN v_source_url := obs_rec.source_url; END IF;
        
        v_fields := v_fields || jsonb_build_object(
          'fee_' || v_fee_count,
          jsonb_build_object(
            'amount', obs_rec.value_normalized,
            'currency', obs_rec.currency,
            'billing_period', COALESCE(obs_rec.billing_period, 'annual'),
            'raw', obs_rec.value_raw
          )
        );
        
        v_evidence := v_evidence || jsonb_build_object(
          'fee_' || v_fee_count,
          jsonb_build_object(
            'obs_id', obs_rec.obs_id,
            'quote', left(obs_rec.evidence_snippet, 300),
            'source_url', obs_rec.source_url,
            'page_title', obs_rec.page_title,
            'parser_version', obs_rec.parser_version,
            'confidence', obs_rec.confidence
          )
        );
      END LOOP;

      IF v_fee_count = 0 THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      IF rec.entity_type = 'program' AND rec.entity_id IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM programs WHERE id = rec.entity_id) THEN
          v_draft_key := 'osc-file-fee-prog-' || rec.entity_id::text;
          SELECT name_en INTO v_uni_name FROM universities WHERE id = rec.university_id;
          
          IF NOT _dry_run THEN
            INSERT INTO program_draft (
              university_id, university_name, title,
              source_url, schema_version, extracted_json, field_evidence_map,
              review_status, status, last_extracted_at, program_key,
              published_program_id
            ) VALUES (
              rec.university_id,
              COALESCE(v_uni_name, rec.university_id::text),
              (SELECT title FROM programs WHERE id = rec.entity_id),
              v_source_url, v_schema_ver, v_fields, v_evidence,
              'draft', 'pending', now(), v_draft_key, rec.entity_id
            )
            ON CONFLICT (program_key)
              DO UPDATE SET
                extracted_json = program_draft.extracted_json || EXCLUDED.extracted_json,
                field_evidence_map = program_draft.field_evidence_map || EXCLUDED.field_evidence_map,
                schema_version = v_schema_ver,
                review_status = 'draft',
                last_extracted_at = now();
            
            UPDATE official_site_observations
            SET status = 'promoted', reason_code = 'file_fee_to_draft'
            WHERE id = ANY(rec.obs_ids);
          END IF;
          v_promoted_prog := v_promoted_prog + 1;
        ELSE
          IF NOT _dry_run THEN
            UPDATE official_site_observations
            SET status = 'review', reason_code = 'ambiguous_program_scope'
            WHERE id = ANY(rec.obs_ids);
          END IF;
          v_review_only := v_review_only + 1;
        END IF;
        
      ELSIF rec.entity_type = 'university' THEN
        v_draft_key := 'osc-file-fee-uni-' || rec.university_id::text;
        SELECT name_en INTO v_uni_name FROM universities WHERE id = rec.university_id;
        
        IF NOT _dry_run THEN
          INSERT INTO program_draft (
            university_id, university_name, title,
            source_url, schema_version, extracted_json, field_evidence_map,
            review_status, status, last_extracted_at, program_key
          ) VALUES (
            rec.university_id,
            COALESCE(v_uni_name, rec.university_id::text),
            COALESCE(v_uni_name, 'University') || ' — File-Derived Fee Schedule',
            v_source_url, v_schema_ver, v_fields, v_evidence,
            'draft', 'pending', now(), v_draft_key
          )
          ON CONFLICT (program_key)
            DO UPDATE SET
              extracted_json = program_draft.extracted_json || EXCLUDED.extracted_json,
              field_evidence_map = program_draft.field_evidence_map || EXCLUDED.field_evidence_map,
              schema_version = v_schema_ver,
              review_status = 'draft',
              last_extracted_at = now();
          
          UPDATE official_site_observations
          SET status = 'promoted', reason_code = 'file_fee_to_draft'
          WHERE id = ANY(rec.obs_ids);
        END IF;
        v_promoted_uni := v_promoted_uni + 1;
        
      ELSE
        IF NOT _dry_run THEN
          UPDATE official_site_observations
          SET status = 'review', reason_code = 'ambiguous_scope'
          WHERE id = ANY(rec.obs_ids);
        END IF;
        v_review_only := v_review_only + 1;
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'promoted_university', v_promoted_uni,
    'promoted_program', v_promoted_prog,
    'skipped', v_skipped,
    'review_only', v_review_only,
    'dry_run', _dry_run
  );
END;
$$;
