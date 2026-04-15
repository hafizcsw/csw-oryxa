-- LAV #7: Extensions, Indexes, Analytics Rollups, Integration Alerts, Cron Jobs

-- 1) Enable Extensions
create extension if not exists pg_trgm;
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- 2) Programs Performance Indexes
create index if not exists idx_programs_university on programs(university_id);
create index if not exists idx_programs_degree on programs(degree_id);
create index if not exists idx_programs_lang_gin on programs using gin (languages);
create index if not exists idx_programs_certs_gin on programs using gin (accepted_certificates);
create index if not exists idx_programs_title_trgm on programs using gin (title gin_trgm_ops);
create index if not exists idx_programs_desc_trgm on programs using gin (description gin_trgm_ops);

-- 3) Universities Performance Indexes
create index if not exists idx_universities_country on universities(country_id);
create index if not exists idx_universities_name_trgm on universities using gin (name gin_trgm_ops);

-- 4) Analytics Daily Rollup Table
create table if not exists analytics_daily (
  day date primary key,
  page_views int not null default 0,
  chats int not null default 0,
  leads int not null default 0,
  service_clicks int not null default 0
);

-- Enable RLS on analytics_daily
alter table analytics_daily enable row level security;

-- Public read policy for analytics_daily
create policy "Analytics daily are publicly readable"
on analytics_daily for select using (true);

-- 5) Analytics Daily Rollup Function
create or replace function rollup_events_daily()
returns void language plpgsql security definer as $$
begin
  insert into analytics_daily(day, page_views, chats, leads, service_clicks)
  select
    d::date as day,
    coalesce(sum((e.name='page_view')::int), 0) as page_views,
    coalesce(sum((e.name in ('chat_started','chat_identified','assistant_processed'))::int), 0) as chats,
    coalesce(sum((e.name='lead.created')::int), 0) as leads,
    coalesce(sum((e.name='service_icon_clicked')::int), 0) as service_clicks
  from generate_series((now() - interval '7 days')::date, (now())::date, interval '1 day') d
  left join events e on e.created_at::date = d::date
  group by d
  on conflict (day) do update set
    page_views=excluded.page_views,
    chats=excluded.chats,
    leads=excluded.leads,
    service_clicks=excluded.service_clicks;
end $$;

-- 6) Integration Alerts Table
create table if not exists integration_alerts (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  level text not null,
  message text not null
);

-- Enable RLS on integration_alerts
alter table integration_alerts enable row level security;

-- Public read policy for integration_alerts
create policy "Integration alerts are publicly readable"
on integration_alerts for select using (true);

-- 7) Integration Alert Trigger Function
create or replace function raise_integration_alert()
returns trigger language plpgsql security definer as $$
begin
  if (new.status = 'error') then
    insert into integration_alerts(level, message)
    values ('error', coalesce(new.last_error, 'Integration error occurred'));
  end if;
  return new;
end $$;

-- Drop existing trigger if exists
drop trigger if exists trg_integration_error on integration_events;

-- Create trigger for integration errors
create trigger trg_integration_error
after update on integration_events
for each row
when (new.status = 'error' and (old.status is distinct from new.status))
execute procedure raise_integration_alert();

-- 8) Cron Job: Bridge Flush Every 5 Minutes
select cron.schedule(
  'bridge_flush_every_5m',
  '*/5 * * * *',
  $$
    select net.http_post(
      url := 'https://alkhaznaqdlxygeznapt.supabase.co/functions/v1/bridge-flush',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{}'::jsonb
    )
  $$
);

-- 9) Cron Job: Analytics Daily Rollup at 02:10 AM
select cron.schedule(
  'rollup_events_daily_0210',
  '10 2 * * *',
  $$ select rollup_events_daily(); $$
);