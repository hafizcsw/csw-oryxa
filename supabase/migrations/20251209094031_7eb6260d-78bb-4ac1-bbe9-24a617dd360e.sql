-- Phase 2: Security Fixes

-- 2.1 Convert Security Definer Views to Security Invoker
ALTER VIEW public.programs_view SET (security_invoker = true);
ALTER VIEW public.vw_admissions_public SET (security_invoker = true);
ALTER VIEW public.vw_events_search SET (security_invoker = true);
ALTER VIEW public.vw_harvest_job_summary SET (security_invoker = true);
ALTER VIEW public.vw_program_details SET (security_invoker = true);
ALTER VIEW public.vw_program_search SET (security_invoker = true);
ALTER VIEW public.vw_scholarship_search SET (security_invoker = true);
ALTER VIEW public.vw_scholarships_public SET (security_invoker = true);
ALTER VIEW public.vw_slider_active SET (security_invoker = true);
ALTER VIEW public.vw_university_card SET (security_invoker = true);
ALTER VIEW public.vw_university_catalog SET (security_invoker = true);
ALTER VIEW public.vw_university_details SET (security_invoker = true);
ALTER VIEW public.vw_university_program_signals SET (security_invoker = true);
ALTER VIEW public.vw_university_search SET (security_invoker = true);
ALTER VIEW public.vw_visitors_daily SET (security_invoker = true);

-- 2.2 Add RLS policies to tables without policies (read-only for public data, admin-only for internal)

-- ai_extractions: admin only
ALTER TABLE public.ai_extractions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_extractions_admin_only" ON public.ai_extractions
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- contract_templates: public read, admin write
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contract_templates_public_read" ON public.contract_templates
FOR SELECT USING (true);
CREATE POLICY "contract_templates_admin_write" ON public.contract_templates
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ingest_artifacts: admin only
ALTER TABLE public.ingest_artifacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ingest_artifacts_admin_only" ON public.ingest_artifacts
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ingest_jobs: admin only
ALTER TABLE public.ingest_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ingest_jobs_admin_only" ON public.ingest_jobs
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ingestion_source_templates: admin only
ALTER TABLE public.ingestion_source_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ingestion_source_templates_admin_only" ON public.ingestion_source_templates
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- subjects: public read
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subjects_public_read" ON public.subjects
FOR SELECT USING (true);

-- translation_templates: admin only
ALTER TABLE public.translation_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "translation_templates_admin_only" ON public.translation_templates
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- unis_assistant_events: admin only
ALTER TABLE public.unis_assistant_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "unis_assistant_events_admin_only" ON public.unis_assistant_events
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- unis_assistant_policies: admin only
ALTER TABLE public.unis_assistant_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "unis_assistant_policies_admin_only" ON public.unis_assistant_policies
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- university_media_suggestions: admin only
ALTER TABLE public.university_media_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "university_media_suggestions_admin_only" ON public.university_media_suggestions
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));