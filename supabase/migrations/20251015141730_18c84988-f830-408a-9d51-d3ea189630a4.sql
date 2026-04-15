-- LAV #12: Recommendations system - Part 1 (Tables and indexes only)

-- 1) Recommendations cache table
create table if not exists recommendations_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  visitor_id text,
  program_id uuid not null,
  score numeric not null,
  reasons jsonb,
  created_at timestamptz default now()
);

alter table recommendations_cache enable row level security;

create policy "reco_cache_public_read" on recommendations_cache 
  for select using (true);

create index if not exists idx_reco_user on recommendations_cache(user_id, created_at desc);
create index if not exists idx_reco_visitor on recommendations_cache(visitor_id, created_at desc);
create index if not exists idx_reco_program on recommendations_cache(program_id);
create index if not exists idx_reco_reasons_gin on recommendations_cache using gin (reasons);

-- 2) Indexes for scholarships
create index if not exists idx_sch_country on scholarships(country_id);
create index if not exists idx_sch_degree on scholarships(degree_id);
create index if not exists idx_sch_status on scholarships(status);
create index if not exists idx_sch_deadline on scholarships(deadline) where status = 'published';