-- Phase 3: Fix materialized view access (pg_trgm stays in public due to dependent indexes)

-- Revoke public/anon access from materialized view
REVOKE ALL ON public.mv_university_catalog_fts FROM anon;
REVOKE ALL ON public.mv_university_catalog_fts FROM public;

-- Grant only to authenticated and service_role
GRANT SELECT ON public.mv_university_catalog_fts TO authenticated;
GRANT ALL ON public.mv_university_catalog_fts TO service_role;