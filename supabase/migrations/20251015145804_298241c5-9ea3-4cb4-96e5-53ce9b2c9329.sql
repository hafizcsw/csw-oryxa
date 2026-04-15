-- LAV #14: Growth & Internationalization

-- 1) Feature Flags
create table if not exists feature_flags (
  key text primary key,
  enabled boolean not null default false,
  payload jsonb,
  updated_at timestamptz not null default now()
);

alter table feature_flags enable row level security;

create policy "ff_public_read"
  on feature_flags for select
  using (true);

-- Insert default flags
insert into feature_flags (key, enabled) values
  ('recs.enabled', true),
  ('scholarships.enabled', true),
  ('email.enabled', false),
  ('compare.enabled', true),
  ('counselor.enabled', true)
on conflict (key) do nothing;

-- 2) Counselor Assignments
create table if not exists counselor_assignments (
  application_id uuid references applications(id) on delete cascade,
  user_id uuid references profiles(user_id) on delete cascade,
  assigned_by uuid references profiles(user_id),
  created_at timestamptz default now(),
  primary key (application_id, user_id)
);

alter table counselor_assignments enable row level security;

create policy "ca_admin_all"
  on counselor_assignments for all
  using (true)
  with check (true);

-- 3) Counselor Notes
create table if not exists counselor_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  author_id uuid references profiles(user_id) on delete set null,
  visibility text not null check (visibility in ('internal','applicant')) default 'internal',
  note text not null,
  created_at timestamptz default now()
);

create index if not exists idx_counselor_notes_app on counselor_notes(application_id);
create index if not exists idx_counselor_notes_author on counselor_notes(author_id);

alter table counselor_notes enable row level security;

create policy "cn_admin_all"
  on counselor_notes for all
  using (true)
  with check (true);

-- 4) Email channel support (already exists in notifications table)
-- Add index for email notifications
create index if not exists idx_notifications_email
  on notifications(channel, status) where channel = 'email';