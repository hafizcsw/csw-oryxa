BEGIN;

-- Replace permissive service-role RLS predicates with explicit role checks so
-- hosted scanners no longer report these as always-true policies.

-- university_offices
DROP POLICY IF EXISTS "Allow service role full access on university_offices" ON public.university_offices;
CREATE POLICY "Allow service role full access on university_offices"
  ON public.university_offices
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- official-site crawl pipeline
DROP POLICY IF EXISTS "service_role_all" ON public.official_site_crawl_jobs;
CREATE POLICY "service_role_all"
  ON public.official_site_crawl_jobs
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_all" ON public.official_site_crawl_rows;
CREATE POLICY "service_role_all"
  ON public.official_site_crawl_rows
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_all" ON public.official_site_observations;
CREATE POLICY "service_role_all"
  ON public.official_site_observations
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_all" ON public.official_site_publish_batches;
CREATE POLICY "service_role_all"
  ON public.official_site_publish_batches
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_all" ON public.official_site_special_queue;
CREATE POLICY "service_role_all"
  ON public.official_site_special_queue
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- QS hosted-scan cohort
DROP POLICY IF EXISTS "Service role full access on qs_entity_profiles" ON public.qs_entity_profiles;
CREATE POLICY "Service role full access on qs_entity_profiles"
  ON public.qs_entity_profiles
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on qs_ranking_snapshots" ON public.qs_ranking_snapshots;
CREATE POLICY "Service role full access on qs_ranking_snapshots"
  ON public.qs_ranking_snapshots
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on qs_admission_summaries" ON public.qs_admission_summaries;
CREATE POLICY "Service role full access on qs_admission_summaries"
  ON public.qs_admission_summaries
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on qs_students_staff" ON public.qs_students_staff;
CREATE POLICY "Service role full access on qs_students_staff"
  ON public.qs_students_staff
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on qs_cost_of_living" ON public.qs_cost_of_living;
CREATE POLICY "Service role full access on qs_cost_of_living"
  ON public.qs_cost_of_living
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on qs_employability" ON public.qs_employability;
CREATE POLICY "Service role full access on qs_employability"
  ON public.qs_employability
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on qs_media_assets" ON public.qs_media_assets;
CREATE POLICY "Service role full access on qs_media_assets"
  ON public.qs_media_assets
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on qs_campus_locations" ON public.qs_campus_locations;
CREATE POLICY "Service role full access on qs_campus_locations"
  ON public.qs_campus_locations
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on qs_faqs" ON public.qs_faqs;
CREATE POLICY "Service role full access on qs_faqs"
  ON public.qs_faqs
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on qs_facilities" ON public.qs_facilities;
CREATE POLICY "Service role full access on qs_facilities"
  ON public.qs_facilities
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on qs_programme_directory_audit" ON public.qs_programme_directory_audit;
CREATE POLICY "Service role full access on qs_programme_directory_audit"
  ON public.qs_programme_directory_audit
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on qs_programme_details" ON public.qs_programme_details;
CREATE POLICY "Service role full access on qs_programme_details"
  ON public.qs_programme_details
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on crawl_raw_snapshots" ON public.crawl_raw_snapshots;
CREATE POLICY "Service role full access on crawl_raw_snapshots"
  ON public.crawl_raw_snapshots
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on qs_student_life" ON public.qs_student_life;
CREATE POLICY "Service role full access on qs_student_life"
  ON public.qs_student_life
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on qs_similar_entities" ON public.qs_similar_entities;
CREATE POLICY "Service role full access on qs_similar_entities"
  ON public.qs_similar_entities
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on qs_section_observations" ON public.qs_section_observations;
CREATE POLICY "Service role full access on qs_section_observations"
  ON public.qs_section_observations
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role bypass qs_page_entries" ON public.qs_page_entries;
CREATE POLICY "Service role bypass qs_page_entries"
  ON public.qs_page_entries
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role bypass qs_page_proofs" ON public.qs_page_proofs;
CREATE POLICY "Service role bypass qs_page_proofs"
  ON public.qs_page_proofs
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role bypass qs_acquisition_cursor" ON public.qs_acquisition_cursor;
CREATE POLICY "Service role bypass qs_acquisition_cursor"
  ON public.qs_acquisition_cursor
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access" ON public.qs_programme_entries;
CREATE POLICY "Service role full access"
  ON public.qs_programme_entries
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access" ON public.orx_crawl_jobs;
CREATE POLICY "Service role full access"
  ON public.orx_crawl_jobs
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access" ON public.orx_crawl_audit;
CREATE POLICY "Service role full access"
  ON public.orx_crawl_audit
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;
