-- جلسة زائر (ويب/واتساب لاحقاً)
create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  channel text default 'web',
  crm_contact_id text,
  created_at timestamptz default now()
);
alter table chat_sessions enable row level security;
create policy cs_select_all on chat_sessions for select using (true);

-- رسائل بسيطة لتتبّع المحادثة
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references chat_sessions(id) on delete cascade,
  role text check (role in ('user','assistant')) not null,
  content text not null,
  meta jsonb,
  created_at timestamptz default now()
);
alter table chat_messages enable row level security;
create policy cm_select_all on chat_messages for select using (true);

-- أحداث عامة للأناليتيكس
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  session_id uuid,
  visitor_id text,
  properties jsonb,
  created_at timestamptz default now()
);
alter table events enable row level security;
create policy ev_select_all on events for select using (true);