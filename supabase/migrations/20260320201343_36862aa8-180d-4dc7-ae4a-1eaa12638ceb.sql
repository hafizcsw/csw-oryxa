
-- Fix: universities table has no updated_at column, remove it from RPCs

CREATE OR REPLACE FUNCTION public.rpc_publish_university_contacts(p_university_id uuid, p_trace_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_field record;
  v_field_map jsonb := '{
    "email": "contact_email",
    "phone": "contact_phone",
    "apply_url": "apply_url",
    "inquiry_url": "inquiry_url",
    "contact_url": "contact_url",
    "visit_url": "visit_url",
    "student_portal_url": "student_portal_url"
  }'::jsonb;
BEGIN
  FOR v_field IN
    SELECT DISTINCT ON (o.field_name)
      o.field_name, o.value_raw, o.id AS obs_id
    FROM public.official_site_observations o
    WHERE o.university_id = p_university_id
      AND o.source_type = 'official_website'
      AND o.status IN ('new','verified')
      AND o.entity_type = 'university'
      AND o.field_name IN ('email','phone','apply_url','inquiry_url','contact_url','visit_url','student_portal_url')
    ORDER BY o.field_name, o.confidence DESC NULLS LAST, o.created_at DESC
  LOOP
    IF v_field_map ? v_field.field_name THEN
      EXECUTE format(
        'UPDATE public.universities SET %I = $1 WHERE id = $2',
        v_field_map ->> v_field.field_name
      ) USING v_field.value_raw, p_university_id;
      
      UPDATE public.official_site_observations
        SET status = 'published'
        WHERE id = v_field.obs_id;
      
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'published_fields', v_count, 'trace_id', p_trace_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_publish_university_offices(p_university_id uuid, p_trace_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_obs record;
BEGIN
  FOR v_obs IN
    SELECT o.id AS obs_id, o.field_name, o.value_raw,
           o.source_url, o.source_type, o.evidence_snippet, o.confidence
    FROM public.official_site_observations o
    WHERE o.university_id = p_university_id
      AND o.source_type = 'official_website'
      AND o.status IN ('new','verified')
      AND o.entity_type = 'university'
      AND o.field_name LIKE 'office_%'
    ORDER BY o.confidence DESC NULLS LAST
  LOOP
    DECLARE
      v_parts text[] := string_to_array(v_obs.field_name, '_');
      v_office_type text;
      v_office_field text;
    BEGIN
      IF array_length(v_parts, 1) >= 3 THEN
        v_office_type := v_parts[2];
        v_office_field := v_parts[3];
        
        INSERT INTO public.university_offices (university_id, office_type, source_url, source_type, evidence_snippet, confidence, review_status)
        VALUES (p_university_id, v_office_type, v_obs.source_url, v_obs.source_type, v_obs.evidence_snippet, v_obs.confidence, 'published')
        ON CONFLICT ON CONSTRAINT uq_university_offices_type DO NOTHING;

        IF v_office_field IN ('email','phone','url','name','location','office_hours','notes') THEN
          EXECUTE format(
            'UPDATE public.university_offices SET %I = $1 WHERE university_id = $2 AND office_type = $3',
            v_office_field
          ) USING v_obs.value_raw, p_university_id, v_office_type;
        END IF;

        UPDATE public.official_site_observations SET status = 'published' WHERE id = v_obs.obs_id;
        v_count := v_count + 1;
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'published_offices', v_count, 'trace_id', p_trace_id);
END;
$$;
