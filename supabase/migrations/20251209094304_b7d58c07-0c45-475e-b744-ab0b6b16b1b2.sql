-- Phase 2.3: Add search_path to SECURITY DEFINER functions that don't have it

-- update_programs_updated_at
ALTER FUNCTION public.update_programs_updated_at() SET search_path = public;

-- update_web_chat_sessions_updated_at  
ALTER FUNCTION public.update_web_chat_sessions_updated_at() SET search_path = public;

-- set_updated_at
ALTER FUNCTION public.set_updated_at() SET search_path = public;

-- update_university_media_suggestions_updated_at
ALTER FUNCTION public.update_university_media_suggestions_updated_at() SET search_path = public;

-- clean_old_events (SECURITY DEFINER)
ALTER FUNCTION public.clean_old_events() SET search_path = public;

-- fn_student_progress_from_substage
ALTER FUNCTION public.fn_student_progress_from_substage(text) SET search_path = public;

-- trg_profiles_set_progress
ALTER FUNCTION public.trg_profiles_set_progress() SET search_path = public;

-- log_unis_event (SECURITY DEFINER)
ALTER FUNCTION public.log_unis_event(text, uuid, uuid, jsonb, integer) SET search_path = public;

-- admin_merge_university_draft (SECURITY DEFINER)
ALTER FUNCTION public.admin_merge_university_draft(bigint) SET search_path = public;

-- get_schema_info (SECURITY DEFINER)
ALTER FUNCTION public.get_schema_info() SET search_path = public;

-- admin_merge_program_draft (SECURITY DEFINER)
ALTER FUNCTION public.admin_merge_program_draft(bigint) SET search_path = public;

-- admin_merge_scholarship_draft (SECURITY DEFINER)
ALTER FUNCTION public.admin_merge_scholarship_draft(bigint) SET search_path = public;

-- fees_verdict
ALTER FUNCTION public.fees_verdict(numeric, numeric, text, text, date) SET search_path = public;

-- run_double_validation (SECURITY DEFINER)
ALTER FUNCTION public.run_double_validation(integer) SET search_path = public;

-- check_rate_limit (SECURITY DEFINER)
ALTER FUNCTION public.check_rate_limit(text, text, integer, integer) SET search_path = public;

-- get_system_health_v2 (SECURITY DEFINER)
ALTER FUNCTION public.get_system_health_v2() SET search_path = public;

-- calculate_country_quality_score (SECURITY DEFINER)
ALTER FUNCTION public.calculate_country_quality_score(text) SET search_path = public;

-- populate_review_queue_from_job (SECURITY DEFINER)
ALTER FUNCTION public.populate_review_queue_from_job(bigint) SET search_path = public;

-- create_timeline_event_on_substage_change (SECURITY DEFINER)
ALTER FUNCTION public.create_timeline_event_on_substage_change() SET search_path = public;

-- update_scholarships_updated_at
ALTER FUNCTION public.update_scholarships_updated_at() SET search_path = public;

-- rollup_events_daily (SECURITY DEFINER)
ALTER FUNCTION public.rollup_events_daily() SET search_path = public;

-- raise_integration_alert (SECURITY DEFINER)
ALTER FUNCTION public.raise_integration_alert() SET search_path = public;

-- check_daily_application_limit
ALTER FUNCTION public.check_daily_application_limit(text) SET search_path = public;

-- is_site_readonly
ALTER FUNCTION public.is_site_readonly() SET search_path = public;

-- update_updated_at
ALTER FUNCTION public.update_updated_at() SET search_path = public;