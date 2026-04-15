-- Add admin-only SELECT policies to tables that have RLS enabled but no policies
-- These are internal/staging tables that should only be accessible to admins

CREATE POLICY "admin_select_only" ON public.city_backfill_csv FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "admin_select_only" ON public.city_coordinates FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "admin_select_only" ON public.portal_customer_map FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "admin_select_only" ON public.qs_slug_staging FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "admin_select_only" ON public.spreadsheet_enrichment_staging FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "admin_select_only" ON public.university_duplicates FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "admin_select_only" ON public.university_source_evidence FOR SELECT USING (public.is_admin(auth.uid()));
