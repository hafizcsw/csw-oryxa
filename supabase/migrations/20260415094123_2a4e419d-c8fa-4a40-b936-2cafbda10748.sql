
-- Views: set security_invoker = true
ALTER VIEW public.vw_orx_facts_stale SET (security_invoker = true);
ALTER VIEW public.vw_scholarship_search_api SET (security_invoker = true);
ALTER VIEW public.vw_university_card SET (security_invoker = true);
ALTER VIEW public.vw_orx_facts_audit_summary SET (security_invoker = true);
ALTER VIEW public.source_health_v1 SET (security_invoker = true);
ALTER VIEW public.door2_review_current_v1 SET (security_invoker = true);
ALTER VIEW public.vw_program_search SET (security_invoker = true);
ALTER VIEW public.vw_orx_facts_published SET (security_invoker = true);
ALTER VIEW public.vw_program_search_api SET (security_invoker = true);
ALTER VIEW public.vw_orx_facts_rejected SET (security_invoker = true);
ALTER VIEW public.vw_orx_entity_coverage SET (security_invoker = true);
ALTER VIEW public.vw_university_details SET (security_invoker = true);
ALTER VIEW public.uniranks_job_health_v1 SET (security_invoker = true);
ALTER VIEW public.vw_orx_dimension_facts_published SET (security_invoker = true);
ALTER VIEW public.vw_orx_dimension_readiness SET (security_invoker = true);
ALTER VIEW public.vw_entity_enrichment_published SET (security_invoker = true);
ALTER VIEW public.program_quality_v3 SET (security_invoker = true);
ALTER VIEW public.vw_program_search_api_v3_final SET (security_invoker = true);
ALTER VIEW public.vw_orx_dimension_facts_internal SET (security_invoker = true);
ALTER VIEW public.vw_orx_facts_approved_unpublished SET (security_invoker = true);
ALTER VIEW public.vw_portal_applications_v1 SET (security_invoker = true);
ALTER VIEW public.vw_program_details SET (security_invoker = true);
ALTER VIEW public.vw_university_program_signals SET (security_invoker = true);
ALTER VIEW public.vw_orx_facts_pending_review SET (security_invoker = true);
ALTER VIEW public.fx_rates_latest SET (security_invoker = true);

-- RLS on remaining tables (inbox already done)
ALTER TABLE public.temp_website_import ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.russian_learning_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read russian_learning_courses" ON public.russian_learning_courses FOR SELECT USING (true);

ALTER TABLE public.russian_learning_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read russian_learning_modules" ON public.russian_learning_modules FOR SELECT USING (true);

ALTER TABLE public.russian_learning_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read russian_learning_lessons" ON public.russian_learning_lessons FOR SELECT USING (true);

ALTER TABLE public.russian_learning_lesson_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read russian_learning_lesson_sections" ON public.russian_learning_lesson_sections FOR SELECT USING (true);

ALTER TABLE public.russian_readiness_dimensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read russian_readiness_dimensions" ON public.russian_readiness_dimensions FOR SELECT USING (true);

ALTER TABLE public.russian_assessment_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read russian_assessment_templates" ON public.russian_assessment_templates FOR SELECT USING (true);

ALTER TABLE public.russian_exam_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read russian_exam_sets" ON public.russian_exam_sets FOR SELECT USING (true);

ALTER TABLE public.university_page_spaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read university_page_spaces" ON public.university_page_spaces FOR SELECT USING (true);

ALTER TABLE public.page_edit_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read page_edit_proposals" ON public.page_edit_proposals FOR SELECT TO authenticated USING (true);

ALTER TABLE public.university_page_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read university_page_members" ON public.university_page_members FOR SELECT TO authenticated USING (true);

ALTER TABLE public.university_page_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read university_page_roles" ON public.university_page_roles FOR SELECT TO authenticated USING (true);

ALTER TABLE public.university_page_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read university_page_posts" ON public.university_page_posts FOR SELECT USING (true);

ALTER TABLE public.university_page_post_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read university_page_post_media" ON public.university_page_post_media FOR SELECT USING (true);
