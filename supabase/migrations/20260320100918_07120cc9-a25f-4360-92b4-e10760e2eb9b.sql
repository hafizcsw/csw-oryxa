
ALTER TABLE public.official_site_observations DROP CONSTRAINT IF EXISTS official_site_observations_status_check;
ALTER TABLE public.official_site_observations ADD CONSTRAINT official_site_observations_status_check 
  CHECK (status = ANY (ARRAY['new','quarantined','verified','rejected','published','promoted','review']));
