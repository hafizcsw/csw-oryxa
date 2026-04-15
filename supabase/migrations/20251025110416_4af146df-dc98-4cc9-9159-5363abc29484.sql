-- Create wrapper function for is_admin without params
create or replace function is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return is_admin(auth.uid());
end;
$$;

-- Storage bucket for ingest (if not exists)
insert into storage.buckets (id, name, public)
values ('ingest', 'ingest', false)
on conflict (id) do nothing;

-- Policy table for assistant rules
create table if not exists unis_assistant_policies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rules jsonb not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table unis_assistant_policies enable row level security;

create policy "admin_rw_policies" on unis_assistant_policies
  using (is_admin()) with check (is_admin());

-- Telemetry events for unis assistant
create table if not exists unis_assistant_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  user_id uuid references auth.users(id),
  job_id uuid,
  context jsonb,
  duration_ms integer,
  created_at timestamptz default now()
);

create index idx_unis_events_type on unis_assistant_events(event_type);
create index idx_unis_events_created on unis_assistant_events(created_at desc);

alter table unis_assistant_events enable row level security;

create policy "admin_read_events" on unis_assistant_events
  for select using (is_admin());

-- Function to log assistant events
create or replace function log_unis_event(
  p_event_type text,
  p_user_id uuid,
  p_job_id uuid default null,
  p_context jsonb default null,
  p_duration_ms integer default null
) returns void
language plpgsql security definer
as $$
begin
  insert into unis_assistant_events(event_type, user_id, job_id, context, duration_ms)
  values (p_event_type, p_user_id, p_job_id, p_context, p_duration_ms);
end;
$$;

-- Insert default policy
insert into unis_assistant_policies (name, rules, is_active)
values (
  'Default Policy',
  '{
    "rules": [
      {"country_iso": "AE", "level": "bachelors", "max_tuition_per_year": 15000, "allowed_study_languages": ["EN","AR"]},
      {"country_iso": "UK", "level": "masters", "max_tuition_per_year": 22000, "allowed_study_languages": ["EN"]}
    ],
    "defaults": {
      "allowed_study_languages": ["EN"],
      "max_tuition_per_year": 20000
    }
  }'::jsonb,
  false
)
on conflict do nothing;

-- Storage policies for ingest bucket
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname='storage' and tablename='objects' 
    and policyname='ingest_admin_upload'
  ) then
    create policy ingest_admin_upload on storage.objects
      for insert to authenticated
      with check (bucket_id='ingest' and is_admin(auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies 
    where schemaname='storage' and tablename='objects' 
    and policyname='ingest_admin_select'
  ) then
    create policy ingest_admin_select on storage.objects
      for select to authenticated
      using (bucket_id='ingest' and is_admin(auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies 
    where schemaname='storage' and tablename='objects' 
    and policyname='ingest_admin_update'
  ) then
    create policy ingest_admin_update on storage.objects
      for update to authenticated
      using (bucket_id='ingest' and is_admin(auth.uid()))
      with check (bucket_id='ingest' and is_admin(auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies 
    where schemaname='storage' and tablename='objects' 
    and policyname='ingest_admin_delete'
  ) then
    create policy ingest_admin_delete on storage.objects
      for delete to authenticated
      using (bucket_id='ingest' and is_admin(auth.uid()));
  end if;
end $$;