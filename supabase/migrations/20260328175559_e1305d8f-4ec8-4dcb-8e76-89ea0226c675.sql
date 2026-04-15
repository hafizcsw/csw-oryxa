
-- ================================================================
-- FIX: Drop all RLS policies wrongly targeting {public} role
-- and recreate them targeting {service_role} only.
-- This fixes 6 critical security findings.
-- ================================================================

-- 1. crawl_settings
DROP POLICY IF EXISTS "Service role full access on crawl_settings" ON crawl_settings;
CREATE POLICY "srv_all_crawl_settings" ON crawl_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. official_site_crawl_jobs
DROP POLICY IF EXISTS "service_role_all" ON official_site_crawl_jobs;
CREATE POLICY "srv_all_official_site_crawl_jobs" ON official_site_crawl_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. official_site_crawl_rows
DROP POLICY IF EXISTS "service_role_all" ON official_site_crawl_rows;
CREATE POLICY "srv_all_official_site_crawl_rows" ON official_site_crawl_rows FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. official_site_observations
DROP POLICY IF EXISTS "service_role_all" ON official_site_observations;
CREATE POLICY "srv_all_official_site_observations" ON official_site_observations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. official_site_special_queue
DROP POLICY IF EXISTS "service_role_all" ON official_site_special_queue;
CREATE POLICY "srv_all_official_site_special_queue" ON official_site_special_queue FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. official_site_publish_batches
DROP POLICY IF EXISTS "service_role_all" ON official_site_publish_batches;
CREATE POLICY "srv_all_official_site_publish_batches" ON official_site_publish_batches FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 7. orx_crawl_jobs
DROP POLICY IF EXISTS "Service role full access" ON orx_crawl_jobs;
CREATE POLICY "srv_all_orx_crawl_jobs" ON orx_crawl_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 8. orx_crawl_audit
DROP POLICY IF EXISTS "Service role full access" ON orx_crawl_audit;
CREATE POLICY "srv_all_orx_crawl_audit" ON orx_crawl_audit FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 9. city_backfill_staging
DROP POLICY IF EXISTS "Service role full access" ON city_backfill_staging;
CREATE POLICY "srv_all_city_backfill_staging" ON city_backfill_staging FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 10-24. QS tables
DROP POLICY IF EXISTS "Service role full access on qs_admission_summaries" ON qs_admission_summaries;
CREATE POLICY "srv_all_qs_admission_summaries" ON qs_admission_summaries FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on qs_students_staff" ON qs_students_staff;
CREATE POLICY "srv_all_qs_students_staff" ON qs_students_staff FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on qs_ranking_snapshots" ON qs_ranking_snapshots;
CREATE POLICY "srv_all_qs_ranking_snapshots" ON qs_ranking_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on qs_facilities" ON qs_facilities;
CREATE POLICY "srv_all_qs_facilities" ON qs_facilities FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on qs_faqs" ON qs_faqs;
CREATE POLICY "srv_all_qs_faqs" ON qs_faqs FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on qs_similar_entities" ON qs_similar_entities;
CREATE POLICY "srv_all_qs_similar_entities" ON qs_similar_entities FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on qs_section_observations" ON qs_section_observations;
CREATE POLICY "srv_all_qs_section_observations" ON qs_section_observations FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on qs_media_assets" ON qs_media_assets;
CREATE POLICY "srv_all_qs_media_assets" ON qs_media_assets FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on qs_cost_of_living" ON qs_cost_of_living;
CREATE POLICY "srv_all_qs_cost_of_living" ON qs_cost_of_living FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on qs_campus_locations" ON qs_campus_locations;
CREATE POLICY "srv_all_qs_campus_locations" ON qs_campus_locations FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on qs_employability" ON qs_employability;
CREATE POLICY "srv_all_qs_employability" ON qs_employability FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on qs_programme_details" ON qs_programme_details;
DROP POLICY IF EXISTS "Service role full access" ON qs_programme_details;
CREATE POLICY "srv_all_qs_programme_details" ON qs_programme_details FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access" ON qs_programme_entries;
CREATE POLICY "srv_all_qs_programme_entries" ON qs_programme_entries FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on qs_programme_directory_audit" ON qs_programme_directory_audit;
CREATE POLICY "srv_all_qs_programme_directory_audit" ON qs_programme_directory_audit FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on qs_student_life" ON qs_student_life;
CREATE POLICY "srv_all_qs_student_life" ON qs_student_life FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on qs_entity_profiles" ON qs_entity_profiles;
CREATE POLICY "srv_all_qs_entity_profiles" ON qs_entity_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 25. crawl_file_artifacts
DROP POLICY IF EXISTS "Service role full access on crawl_file_artifacts" ON crawl_file_artifacts;
CREATE POLICY "srv_all_crawl_file_artifacts" ON crawl_file_artifacts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 26. crawl_raw_snapshots
DROP POLICY IF EXISTS "Service role full access on crawl_raw_snapshots" ON crawl_raw_snapshots;
CREATE POLICY "srv_all_crawl_raw_snapshots" ON crawl_raw_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 27. harvest_logs
DROP POLICY IF EXISTS "harvest_logs_admin_all" ON harvest_logs;
CREATE POLICY "srv_all_harvest_logs" ON harvest_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 28. harvest_jobs
DROP POLICY IF EXISTS "harvest_jobs_admin_all" ON harvest_jobs;
CREATE POLICY "srv_all_harvest_jobs" ON harvest_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 29. harvest_runs
DROP POLICY IF EXISTS "harvest_runs_admin_all" ON harvest_runs;
CREATE POLICY "srv_all_harvest_runs" ON harvest_runs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 30. counselor_assignments
DROP POLICY IF EXISTS "ca_admin_all" ON counselor_assignments;
CREATE POLICY "srv_all_counselor_assignments" ON counselor_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 31. counselor_notes
DROP POLICY IF EXISTS "cn_admin_all" ON counselor_notes;
CREATE POLICY "srv_all_counselor_notes" ON counselor_notes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 32. teacher_sessions
DROP POLICY IF EXISTS "Service role full access" ON teacher_sessions;
CREATE POLICY "srv_all_teacher_sessions" ON teacher_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 33. teacher_session_notes
DROP POLICY IF EXISTS "Service role full access" ON teacher_session_notes;
CREATE POLICY "srv_all_teacher_session_notes" ON teacher_session_notes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 34. teacher_session_students
DROP POLICY IF EXISTS "Service role full access" ON teacher_session_students;
CREATE POLICY "srv_all_teacher_session_students" ON teacher_session_students FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 35. teacher_student_session_evaluations
DROP POLICY IF EXISTS "Service role full access" ON teacher_student_session_evaluations;
CREATE POLICY "srv_all_teacher_student_session_evaluations" ON teacher_student_session_evaluations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 36. uni_sources
DROP POLICY IF EXISTS "sources_write_admin" ON uni_sources;
CREATE POLICY "srv_all_uni_sources" ON uni_sources FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 37. testimonials
DROP POLICY IF EXISTS "Admins can manage testimonials" ON testimonials;
CREATE POLICY "srv_all_testimonials" ON testimonials FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 38. university_draft
DROP POLICY IF EXISTS "draft_write_admin" ON university_draft;
CREATE POLICY "srv_all_university_draft" ON university_draft FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 39. scholarship_draft
DROP POLICY IF EXISTS "draft_write_admin3" ON scholarship_draft;
CREATE POLICY "srv_all_scholarship_draft" ON scholarship_draft FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 40. portal_tokens
DROP POLICY IF EXISTS "portal_tokens_system_insert" ON portal_tokens;
CREATE POLICY "srv_insert_portal_tokens" ON portal_tokens FOR INSERT TO service_role WITH CHECK (true);

-- 41. system_alerts
DROP POLICY IF EXISTS "System can insert alerts" ON system_alerts;
CREATE POLICY "srv_insert_system_alerts" ON system_alerts FOR INSERT TO service_role WITH CHECK (true);

-- 42. data_quality_snapshots
DROP POLICY IF EXISTS "System can insert quality snapshots" ON data_quality_snapshots;
CREATE POLICY "srv_insert_data_quality_snapshots" ON data_quality_snapshots FOR INSERT TO service_role WITH CHECK (true);

-- 43. hmac_nonces
DROP POLICY IF EXISTS "Service role can manage nonces" ON hmac_nonces;
CREATE POLICY "srv_all_hmac_nonces" ON hmac_nonces FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 44. integration_events - fix both policies
DROP POLICY IF EXISTS "Service role can manage integration events" ON integration_events;
DROP POLICY IF EXISTS "ie_select_all" ON integration_events;
CREATE POLICY "srv_all_integration_events" ON integration_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 45. uniranks_enrich_jobs
DROP POLICY IF EXISTS "Service role can manage enrich jobs" ON uniranks_enrich_jobs;
CREATE POLICY "srv_all_uniranks_enrich_jobs" ON uniranks_enrich_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 46. events INSERT policy fix
DROP POLICY IF EXISTS "Events are writable by authenticated users or service role" ON events;
CREATE POLICY "srv_insert_events" ON events FOR INSERT TO service_role WITH CHECK (true);
