-- ========== Universities / Programs schema ==========
-- Drop existing if needed to recreate with correct structure
drop table if exists programs cascade;
drop table if exists universities cascade;
drop view if exists programs_view cascade;

create table universities (
  id uuid primary key default gen_random_uuid(),
  country_id uuid references countries(id) on delete restrict,
  name text not null,
  city text,
  logo_url text,
  website text,
  ranking int,
  annual_fees numeric,
  monthly_living numeric,
  description text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table programs (
  id uuid primary key default gen_random_uuid(),
  university_id uuid references universities(id) on delete cascade not null,
  degree_id uuid references degrees(id) on delete restrict,
  title text not null,
  description text,
  languages text[] default array['EN']::text[],
  accepted_certificates text[] default array[]::text[],
  next_intake text,
  duration_months int,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Indexes for performance
create index idx_uni_country on universities(country_id);
create index idx_uni_name on universities(name);
create index idx_uni_fees on universities(annual_fees);
create index idx_uni_living on universities(monthly_living);
create index idx_uni_ranking on universities(ranking);

create index idx_prog_uni on programs(university_id);
create index idx_prog_degree on programs(degree_id);
create index idx_prog_title on programs(title);
create index idx_prog_langs on programs using gin (languages);
create index idx_prog_certs on programs using gin (accepted_certificates);

-- ========== View for search optimization ==========
create or replace view programs_view as
select
  p.id as program_id,
  p.title,
  d.slug as degree_slug,
  u.id as university_id,
  u.name as university_name,
  c.slug as country_slug,
  u.city,
  u.annual_fees,
  u.monthly_living,
  p.languages,
  p.next_intake,
  u.ranking,
  p.accepted_certificates,
  p.description
from programs p
join universities u on u.id = p.university_id
left join degrees d on d.id = p.degree_id
left join countries c on c.id = u.country_id
where p.is_active = true and u.is_active = true;

-- ========== RLS policies ==========
alter table universities enable row level security;
alter table programs enable row level security;

create policy "Universities are publicly readable"
  on universities for select
  using (true);

create policy "Programs are publicly readable"
  on programs for select
  using (true);