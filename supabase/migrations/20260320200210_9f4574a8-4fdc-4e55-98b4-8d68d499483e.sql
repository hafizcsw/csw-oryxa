
-- 1) ECTS credits on programs + program_draft
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS ects_credits integer;
ALTER TABLE public.program_draft ADD COLUMN IF NOT EXISTS ects_credits integer;

-- 2) University canonical contacts / CTAs
ALTER TABLE public.universities ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE public.universities ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE public.universities ADD COLUMN IF NOT EXISTS apply_url text;
ALTER TABLE public.universities ADD COLUMN IF NOT EXISTS inquiry_url text;
ALTER TABLE public.universities ADD COLUMN IF NOT EXISTS contact_url text;
ALTER TABLE public.universities ADD COLUMN IF NOT EXISTS visit_url text;
ALTER TABLE public.universities ADD COLUMN IF NOT EXISTS student_portal_url text;

-- 3) University offices table
CREATE TABLE IF NOT EXISTS public.university_offices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  office_type text NOT NULL CHECK (office_type IN ('admission','visa','international','registrar','financial_aid','housing','student_affairs','other')),
  name text,
  email text,
  phone text,
  url text,
  location text,
  office_hours text,
  notes text,
  source_url text,
  source_type text DEFAULT 'official_website',
  evidence_snippet text,
  confidence numeric,
  review_status text DEFAULT 'pending' CHECK (review_status IN ('pending','verified','rejected','published')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(university_id, office_type)
);

ALTER TABLE public.university_offices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on university_offices"
  ON public.university_offices FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Allow service role full access on university_offices"
  ON public.university_offices FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 4) Publish RPC: university contacts/CTAs from observations
CREATE OR REPLACE FUNCTION public.rpc_publish_university_contacts(
  p_university_id uuid,
  p_trace_id text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
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
    SELECT o.field_name, o.value AS value_raw, o.id AS obs_id
    FROM public.official_site_observations o
    WHERE o.university_id = p_university_id
      AND o.source_type = 'official_website'
      AND o.status IN ('new','verified')
      AND o.entity_type = 'university'
      AND o.field_name IN ('email','phone','apply_url','inquiry_url','contact_url','visit_url','student_portal_url')
    ORDER BY o.confidence DESC NULLS LAST, o.created_at DESC
  LOOP
    IF v_field_map ? v_field.field_name THEN
      EXECUTE format(
        'UPDATE public.universities SET %I = $1, updated_at = now() WHERE id = $2',
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

-- 5) Publish RPC: university offices from observations
CREATE OR REPLACE FUNCTION public.rpc_publish_university_offices(
  p_university_id uuid,
  p_trace_id text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count int := 0;
  v_obs record;
BEGIN
  FOR v_obs IN
    SELECT o.id AS obs_id, o.field_name, o.value AS value_raw,
           o.source_url, o.source_type, o.evidence_snippet, o.confidence
    FROM public.official_site_observations o
    WHERE o.university_id = p_university_id
      AND o.source_type = 'official_website'
      AND o.status IN ('new','verified')
      AND o.entity_type = 'university'
      AND o.field_name LIKE 'office_%'
    ORDER BY o.confidence DESC NULLS LAST
  LOOP
    -- field_name format: office_admission_email, office_visa_phone, etc.
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
        ON CONFLICT (university_id, office_type) DO NOTHING;

        IF v_office_field IN ('email','phone','url','name','location','office_hours','notes') THEN
          EXECUTE format(
            'UPDATE public.university_offices SET %I = $1, updated_at = now() WHERE university_id = $2 AND office_type = $3',
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

-- 6) Update rpc_publish_programs to include ects_credits
-- We add ects_credits to the existing program publish flow
CREATE OR REPLACE FUNCTION public.rpc_publish_program_ects_from_draft(
  p_draft_id bigint,
  p_program_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ects int;
  v_old_ects int;
BEGIN
  SELECT ects_credits INTO v_ects FROM public.program_draft WHERE id = p_draft_id;
  IF v_ects IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_ects_in_draft');
  END IF;
  
  SELECT ects_credits INTO v_old_ects FROM public.programs WHERE id = p_program_id;
  
  UPDATE public.programs SET ects_credits = v_ects, updated_at = now() WHERE id = p_program_id;
  
  RETURN jsonb_build_object('ok', true, 'old_ects', v_old_ects, 'new_ects', v_ects);
END;
$$;
