-- LAV #9: Apply Flow Tables

-- applications (طلب التقديم)
create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  full_name text,
  email text,
  phone text,
  country_slug text,
  degree_slug text,
  language text,
  budget_fees numeric,
  budget_living numeric,
  source text default 'web',
  status text default 'new',
  created_at timestamptz default now()
);

alter table applications enable row level security;

create index if not exists idx_applications_visitor on applications(visitor_id);
create index if not exists idx_applications_status_time on applications(status, created_at desc);

-- application_programs (البرامج المختارة)
create table if not exists application_programs (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  program_id uuid not null references programs(id) on delete cascade,
  created_at timestamptz default now()
);

create index if not exists idx_app_programs_app on application_programs(application_id);

-- application_documents (الملفات المرفوعة)
create table if not exists application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  doc_type text,
  file_path text not null,
  original_name text,
  mime_type text,
  file_size integer,
  status text default 'uploaded',
  created_at timestamptz default now()
);

create index if not exists idx_app_docs_app on application_documents(application_id);

-- RLS (قراءة للأدمن فقط عبر Edge Functions)
create policy "apps_select_admin_only" on applications
  for select using (false);

create policy "appprog_select_admin_only" on application_programs
  for select using (false);

create policy "appdocs_select_admin_only" on application_documents
  for select using (false);

-- Storage bucket للطلبات
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'applications',
  'applications',
  false,
  10485760,
  array['application/pdf','image/jpeg','image/png','image/jpg','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;