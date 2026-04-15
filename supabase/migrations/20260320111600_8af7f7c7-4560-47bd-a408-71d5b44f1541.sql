
CREATE OR REPLACE FUNCTION public.rpc_publish_university_file_fees(
  _university_id uuid DEFAULT NULL,
  _dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb := '[]'::jsonb;
  rec record;
BEGIN
  FOR rec IN
    SELECT 
      pd.id AS draft_id,
      pd.university_id,
      pd.extracted_json,
      pd.field_evidence_map,
      pd.source_url,
      pd.schema_version,
      u.name_en AS uni_name,
      u.annual_fees AS old_annual_fees,
      u.tuition_min AS old_tuition_min,
      u.tuition_max AS old_tuition_max
    FROM program_draft pd
    JOIN universities u ON u.id = pd.university_id
    WHERE pd.schema_version = 'osc_file_fees_v1'
      AND pd.review_status = 'draft'
      AND pd.status = 'pending'
      AND pd.published_program_id IS NULL
      AND (_university_id IS NULL OR pd.university_id = _university_id)
  LOOP
    DECLARE
      v_fees jsonb := rec.extracted_json;
      v_key text;
      v_amount numeric;
      v_currency text;
      v_tuition_amounts numeric[] := '{}';
      v_currencies text[] := '{}';
      v_min numeric;
      v_max numeric;
      v_annual numeric;
      v_primary_currency text;
      v_before_snapshot jsonb;
    BEGIN
      FOR v_key IN SELECT jsonb_object_keys(v_fees)
      LOOP
        v_amount := (v_fees -> v_key ->> 'amount')::numeric;
        v_currency := v_fees -> v_key ->> 'currency';
        
        IF v_amount IS NOT NULL AND v_amount >= 500 THEN
          v_tuition_amounts := array_append(v_tuition_amounts, v_amount);
          v_currencies := array_append(v_currencies, v_currency);
        END IF;
      END LOOP;

      IF array_length(v_tuition_amounts, 1) IS NULL THEN
        v_result := v_result || jsonb_build_object(
          'draft_id', rec.draft_id,
          'university_id', rec.university_id,
          'action', 'skipped',
          'reason', 'no_tuition_level_amounts'
        );
        CONTINUE;
      END IF;

      SELECT val INTO v_primary_currency
      FROM unnest(v_currencies) AS val
      GROUP BY val ORDER BY count(*) DESC LIMIT 1;

      SELECT min(a), max(a) INTO v_min, v_max
      FROM (
        SELECT (v_fees -> k ->> 'amount')::numeric AS a
        FROM jsonb_object_keys(v_fees) AS k
        WHERE (v_fees -> k ->> 'amount')::numeric >= 500
          AND v_fees -> k ->> 'currency' = v_primary_currency
      ) sub;

      SELECT round(avg(a)) INTO v_annual
      FROM (
        SELECT (v_fees -> k ->> 'amount')::numeric AS a
        FROM jsonb_object_keys(v_fees) AS k
        WHERE (v_fees -> k ->> 'amount')::numeric >= 500
          AND v_fees -> k ->> 'currency' = v_primary_currency
      ) sub;

      v_before_snapshot := jsonb_build_object(
        'annual_fees', rec.old_annual_fees,
        'tuition_min', rec.old_tuition_min,
        'tuition_max', rec.old_tuition_max
      );

      IF NOT _dry_run THEN
        UPDATE universities SET
          tuition_min = v_min,
          tuition_max = v_max,
          annual_fees = v_annual
        WHERE id = rec.university_id;

        UPDATE program_draft SET
          review_status = 'published',
          status = 'published',
          extracted_json = extracted_json || jsonb_build_object(
            '_publish_meta', jsonb_build_object(
              'published_at', now(),
              'before_snapshot', v_before_snapshot,
              'computed_min', v_min,
              'computed_max', v_max,
              'computed_annual', v_annual,
              'primary_currency', v_primary_currency,
              'tuition_amounts_count', array_length(v_tuition_amounts, 1)
            )
          )
        WHERE id = rec.draft_id;
      END IF;

      v_result := v_result || jsonb_build_object(
        'draft_id', rec.draft_id,
        'university_id', rec.university_id,
        'university_name', rec.uni_name,
        'action', CASE WHEN _dry_run THEN 'dry_run' ELSE 'published' END,
        'before', v_before_snapshot,
        'after', jsonb_build_object(
          'tuition_min', v_min,
          'tuition_max', v_max,
          'annual_fees', v_annual,
          'primary_currency', v_primary_currency
        ),
        'source_url', rec.source_url,
        'tuition_amounts_count', array_length(v_tuition_amounts, 1)
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'results', v_result,
    'dry_run', _dry_run,
    'executed_at', now()
  );
END;
$$;
