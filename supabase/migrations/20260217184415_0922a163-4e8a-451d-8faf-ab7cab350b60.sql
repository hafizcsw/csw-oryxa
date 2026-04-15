
CREATE POLICY "admin_only_cursor" ON public.catalog_ingest_cursor
  FOR ALL
  USING (is_admin(auth.uid()));
