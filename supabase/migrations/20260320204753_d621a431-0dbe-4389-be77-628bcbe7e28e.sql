-- ============================================================
-- PRE-CRAWL EU ADMISSIONS SCOPE EXPANSION
-- ============================================================

-- 1) program_admission_routes: application route / platform / pre-enrolment / preparatory
CREATE TABLE IF NOT EXISTS public.program_admission_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid REFERENCES public.programs(id) ON DELETE CASCADE,
  university_id uuid REFERENCES public.universities(id) ON DELETE CASCADE,
  route_type text NOT NULL DEFAULT 'direct',
  platform_name text,
  platform_url text,
  route_notes text,
  required_before_university_apply boolean DEFAULT false,
  pre_enrolment_required boolean DEFAULT false,
  pre_enrolment_platform text,
  pre_enrolment_url text,
  visa_route_notes text,
  preparatory_route_required boolean DEFAULT false,
  preparatory_route_type text,
  preparatory_route_name text,
  preparatory_route_notes text,
  source_url text,
  evidence_snippet text,
  confidence numeric DEFAULT 0.5,
  review_status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.program_admission_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read program_admission_routes" ON public.program_admission_routes FOR SELECT TO anon, authenticated USING (true);

-- 2) program_eligibility_rules: structured academic eligibility + country-specific conditions
CREATE TABLE IF NOT EXISTS public.program_eligibility_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid REFERENCES public.programs(id) ON DELETE CASCADE,
  university_id uuid REFERENCES public.universities(id) ON DELETE CASCADE,
  rule_type text NOT NULL,
  applies_to_countries text[],
  condition_type text,
  condition_text text,
  min_value numeric,
  linked_exam text,
  linked_document text,
  linked_route text,
  source_url text,
  evidence_snippet text,
  confidence numeric DEFAULT 0.5,
  review_status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.program_eligibility_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read program_eligibility_rules" ON public.program_eligibility_rules FOR SELECT TO anon, authenticated USING (true);

-- 3) program_required_documents: structured document matrix
CREATE TABLE IF NOT EXISTS public.program_required_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid REFERENCES public.programs(id) ON DELETE CASCADE,
  university_id uuid REFERENCES public.universities(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  document_name text,
  translation_required boolean DEFAULT false,
  certified_copy_required boolean DEFAULT false,
  notes text,
  source_url text,
  evidence_snippet text,
  confidence numeric DEFAULT 0.5,
  review_status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.program_required_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read program_required_documents" ON public.program_required_documents FOR SELECT TO anon, authenticated USING (true);

-- 4) program_deadlines: multiple deadline types per program
CREATE TABLE IF NOT EXISTS public.program_deadlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid REFERENCES public.programs(id) ON DELETE CASCADE,
  university_id uuid REFERENCES public.universities(id) ON DELETE CASCADE,
  deadline_type text NOT NULL,
  deadline_date date,
  deadline_text text,
  academic_year text,
  source_url text,
  evidence_snippet text,
  confidence numeric DEFAULT 0.5,
  review_status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.program_deadlines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read program_deadlines" ON public.program_deadlines FOR SELECT TO anon, authenticated USING (true);

-- 5) Add selection process + application fee columns to programs
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS aptitude_assessment_required boolean,
  ADD COLUMN IF NOT EXISTS multi_stage_selection boolean,
  ADD COLUMN IF NOT EXISTS ranking_selection boolean,
  ADD COLUMN IF NOT EXISTS selection_notes text,
  ADD COLUMN IF NOT EXISTS application_fee_currency text,
  ADD COLUMN IF NOT EXISTS fee_exemption_rule text,
  ADD COLUMN IF NOT EXISTS fee_rule_notes text;

-- 6) Indexes
CREATE INDEX IF NOT EXISTS idx_par_program ON public.program_admission_routes(program_id);
CREATE INDEX IF NOT EXISTS idx_par_university ON public.program_admission_routes(university_id);
CREATE INDEX IF NOT EXISTS idx_per_program ON public.program_eligibility_rules(program_id);
CREATE INDEX IF NOT EXISTS idx_per_university ON public.program_eligibility_rules(university_id);
CREATE INDEX IF NOT EXISTS idx_prd_program ON public.program_required_documents(program_id);
CREATE INDEX IF NOT EXISTS idx_prd_university ON public.program_required_documents(university_id);
CREATE INDEX IF NOT EXISTS idx_pd_program ON public.program_deadlines(program_id);
CREATE INDEX IF NOT EXISTS idx_pd_university ON public.program_deadlines(university_id);

-- 7) Publish RPC for EU admissions scope
CREATE OR REPLACE FUNCTION public.rpc_publish_eu_admissions(
  p_university_id uuid,
  p_trace_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_routes int := 0;
  v_eligibility int := 0;
  v_documents int := 0;
  v_deadlines int := 0;
  v_selection int := 0;
  v_fees int := 0;
  r record;
BEGIN
  -- Publish admission routes from observations
  FOR r IN
    SELECT id, field_name, value_raw, source_url, evidence_snippet, confidence, entity_id
    FROM official_site_observations
    WHERE university_id = p_university_id
      AND fact_group = 'admissions'
      AND field_name IN ('admission_route_type','admission_platform_name','admission_platform_url',
                         'pre_enrolment_required','pre_enrolment_platform','pre_enrolment_url',
                         'preparatory_route_required','preparatory_route_type','preparatory_route_name')
      AND status IN ('new','verified')
  LOOP
    INSERT INTO program_admission_routes (
      program_id, university_id, route_type, platform_name, platform_url,
      source_url, evidence_snippet, confidence, review_status
    ) VALUES (
      r.entity_id::uuid, p_university_id,
      CASE WHEN r.field_name = 'admission_route_type' THEN r.value_raw ELSE 'direct' END,
      CASE WHEN r.field_name = 'admission_platform_name' THEN r.value_raw ELSE NULL END,
      CASE WHEN r.field_name = 'admission_platform_url' THEN r.value_raw ELSE NULL END,
      r.source_url, r.evidence_snippet, r.confidence, 'published'
    ) ON CONFLICT DO NOTHING;
    UPDATE official_site_observations SET status = 'published' WHERE id = r.id;
    v_routes := v_routes + 1;
  END LOOP;

  -- Publish eligibility rules
  FOR r IN
    SELECT id, field_name, value_raw, source_url, evidence_snippet, confidence, entity_id
    FROM official_site_observations
    WHERE university_id = p_university_id
      AND fact_group = 'admissions'
      AND field_name LIKE 'eligibility_%'
      AND status IN ('new','verified')
  LOOP
    INSERT INTO program_eligibility_rules (
      program_id, university_id, rule_type, condition_text,
      min_value, source_url, evidence_snippet, confidence, review_status
    ) VALUES (
      r.entity_id::uuid, p_university_id,
      REPLACE(r.field_name, 'eligibility_', ''),
      r.value_raw,
      CASE WHEN r.field_name = 'eligibility_gpa_minimum' THEN r.value_raw::numeric ELSE NULL END,
      r.source_url, r.evidence_snippet, r.confidence, 'published'
    ) ON CONFLICT DO NOTHING;
    UPDATE official_site_observations SET status = 'published' WHERE id = r.id;
    v_eligibility := v_eligibility + 1;
  END LOOP;

  -- Publish required documents
  FOR r IN
    SELECT id, field_name, value_raw, source_url, evidence_snippet, confidence, entity_id
    FROM official_site_observations
    WHERE university_id = p_university_id
      AND fact_group = 'admissions'
      AND field_name LIKE 'required_doc_%'
      AND status IN ('new','verified')
  LOOP
    INSERT INTO program_required_documents (
      program_id, university_id, document_type, document_name,
      source_url, evidence_snippet, confidence, review_status
    ) VALUES (
      r.entity_id::uuid, p_university_id,
      REPLACE(r.field_name, 'required_doc_', ''),
      r.value_raw,
      r.source_url, r.evidence_snippet, r.confidence, 'published'
    ) ON CONFLICT DO NOTHING;
    UPDATE official_site_observations SET status = 'published' WHERE id = r.id;
    v_documents := v_documents + 1;
  END LOOP;

  -- Publish deadlines
  FOR r IN
    SELECT id, field_name, value_raw, source_url, evidence_snippet, confidence, entity_id
    FROM official_site_observations
    WHERE university_id = p_university_id
      AND fact_group IN ('deadlines_intakes','admissions')
      AND field_name IN ('application_deadline','supporting_documents_deadline','fee_deadline',
                         'results_date','acceptance_reply_deadline','enrollment_deadline')
      AND status IN ('new','verified')
  LOOP
    INSERT INTO program_deadlines (
      program_id, university_id, deadline_type, deadline_text,
      source_url, evidence_snippet, confidence, review_status
    ) VALUES (
      r.entity_id::uuid, p_university_id,
      REPLACE(r.field_name, '_deadline', ''),
      r.value_raw,
      r.source_url, r.evidence_snippet, r.confidence, 'published'
    ) ON CONFLICT DO NOTHING;
    UPDATE official_site_observations SET status = 'published' WHERE id = r.id;
    v_deadlines := v_deadlines + 1;
  END LOOP;

  -- Publish selection process flags to programs
  FOR r IN
    SELECT id, field_name, value_raw, entity_id
    FROM official_site_observations
    WHERE university_id = p_university_id
      AND fact_group = 'admissions'
      AND field_name IN ('aptitude_assessment_required','multi_stage_selection','ranking_selection','selection_notes')
      AND status IN ('new','verified')
      AND entity_id IS NOT NULL
  LOOP
    IF r.field_name = 'aptitude_assessment_required' THEN
      UPDATE programs SET aptitude_assessment_required = (r.value_raw = 'true') WHERE id = r.entity_id::uuid;
    ELSIF r.field_name = 'multi_stage_selection' THEN
      UPDATE programs SET multi_stage_selection = (r.value_raw = 'true') WHERE id = r.entity_id::uuid;
    ELSIF r.field_name = 'ranking_selection' THEN
      UPDATE programs SET ranking_selection = (r.value_raw = 'true') WHERE id = r.entity_id::uuid;
    ELSIF r.field_name = 'selection_notes' THEN
      UPDATE programs SET selection_notes = r.value_raw WHERE id = r.entity_id::uuid;
    END IF;
    UPDATE official_site_observations SET status = 'published' WHERE id = r.id;
    v_selection := v_selection + 1;
  END LOOP;

  -- Publish application fees
  FOR r IN
    SELECT id, field_name, value_raw, entity_id
    FROM official_site_observations
    WHERE university_id = p_university_id
      AND fact_group IN ('admissions','tuition_fees')
      AND field_name IN ('application_fee_amount','application_fee_currency','fee_exemption_rule','fee_rule_notes')
      AND status IN ('new','verified')
      AND entity_id IS NOT NULL
  LOOP
    IF r.field_name = 'application_fee_amount' THEN
      UPDATE programs SET application_fee = r.value_raw::numeric WHERE id = r.entity_id::uuid;
    ELSIF r.field_name = 'application_fee_currency' THEN
      UPDATE programs SET application_fee_currency = r.value_raw WHERE id = r.entity_id::uuid;
    ELSIF r.field_name = 'fee_exemption_rule' THEN
      UPDATE programs SET fee_exemption_rule = r.value_raw WHERE id = r.entity_id::uuid;
    ELSIF r.field_name = 'fee_rule_notes' THEN
      UPDATE programs SET fee_rule_notes = r.value_raw WHERE id = r.entity_id::uuid;
    END IF;
    UPDATE official_site_observations SET status = 'published' WHERE id = r.id;
    v_fees := v_fees + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'routes_published', v_routes,
    'eligibility_published', v_eligibility,
    'documents_published', v_documents,
    'deadlines_published', v_deadlines,
    'selection_published', v_selection,
    'fees_published', v_fees
  );
END;
$$;