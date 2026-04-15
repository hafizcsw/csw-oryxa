-- Create function to refresh FTS materialized view
create or replace function public.refresh_mv_unicat_fts()
returns void 
language sql 
security definer 
set search_path = public
as $$
  refresh materialized view concurrently mv_university_catalog_fts;
$$;

-- Add comment
comment on function public.refresh_mv_unicat_fts() is 'Refreshes the university catalog FTS materialized view after data changes';
