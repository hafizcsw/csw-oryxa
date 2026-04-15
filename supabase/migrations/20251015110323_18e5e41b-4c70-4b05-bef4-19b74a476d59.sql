-- Pending ingestions from bot/scrapers
create table if not exists ingestions_pending (
  id uuid primary key default gen_random_uuid(),
  type text check (type in ('university','program','scholarship')) not null,
  payload jsonb not null,
  source text,
  confidence numeric,
  created_at timestamptz default now()
);

-- Human review of pending ingestions
create table if not exists moderation_queue (
  id uuid primary key default gen_random_uuid(),
  pending_id uuid references ingestions_pending(id) on delete cascade,
  status text check (status in ('pending','approved','rejected')) default 'pending',
  reviewer_id text,
  reason text,
  decided_at timestamptz
);

-- Integration events queue (ensure it exists)
create table if not exists integration_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  payload jsonb not null,
  target text default 'crm',
  idempotency_key text not null unique,
  status text check (status in ('queued','sent','acked','error')) default 'queued',
  last_error text,
  created_at timestamptz default now()
);

-- Useful indexes
create index if not exists idx_ingestions_created on ingestions_pending(created_at desc);
create index if not exists idx_mq_status on moderation_queue(status);
create index if not exists idx_ie_status on integration_events(status);
create index if not exists idx_ie_idempotency on integration_events(idempotency_key);

-- Enable RLS
alter table ingestions_pending enable row level security;
alter table moderation_queue enable row level security;
alter table integration_events enable row level security;

-- Public read access for viewing (no write access via anon)
do $$
begin
  if not exists (select 1 from pg_policies where tablename='integration_events' and policyname='ie_select_all') then
    create policy ie_select_all on integration_events for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='ingestions_pending' and policyname='ing_select_all') then
    create policy ing_select_all on ingestions_pending for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='moderation_queue' and policyname='mq_select_all') then
    create policy mq_select_all on moderation_queue for select using (true);
  end if;
end$$;