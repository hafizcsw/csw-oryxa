-- Admin RPC function for listing applications
create or replace function admin_list_applications()
returns table (
  id uuid,
  created_at timestamptz,
  full_name text,
  email text,
  phone text,
  country_slug text,
  degree_slug text,
  language text,
  status text,
  programs_count int,
  documents_count int
)
language sql security definer
set search_path = public
as $$
  select a.id, a.created_at, a.full_name, a.email, a.phone,
         a.country_slug, a.degree_slug, a.language, a.status,
         (select count(*)::int from application_programs ap where ap.application_id = a.id) as programs_count,
         (select count(*)::int from application_documents ad where ad.application_id = a.id) as documents_count
    from applications a
   order by a.created_at desc
   limit 200;
$$;

-- Add unique constraint on idempotency_key for integration_events
do $$ 
begin
  if not exists (
    select 1 from pg_constraint where conname = 'uq_integration_events_idem'
  ) then
    alter table integration_events add constraint uq_integration_events_idem unique (idempotency_key);
  end if;
exception when others then null;
end $$;