-- ============================================================
-- P1: i18n + Aliases Infrastructure for Most Languages
-- ============================================================

-- 1) i18n tables (no language constraints - BCP-47 open)
create table if not exists public.university_i18n (
  university_id uuid not null references public.universities(id) on delete cascade,
  lang_code text not null,
  name text,
  description text,
  highlights jsonb,
  quality_score int not null default 0,
  source text,
  updated_at timestamptz not null default now(),
  primary key (university_id, lang_code)
);

create table if not exists public.program_i18n (
  program_id uuid not null references public.programs(id) on delete cascade,
  lang_code text not null,
  name text,
  description text,
  outcomes jsonb,
  quality_score int not null default 0,
  source text,
  updated_at timestamptz not null default now(),
  primary key (program_id, lang_code)
);

-- 2) RLS for i18n tables
alter table public.university_i18n enable row level security;
alter table public.program_i18n enable row level security;

-- Public read
drop policy if exists i18n_public_read_uni on public.university_i18n;
create policy i18n_public_read_uni
on public.university_i18n for select to public
using (true);

drop policy if exists i18n_public_read_prog on public.program_i18n;
create policy i18n_public_read_prog
on public.program_i18n for select to public
using (true);

-- Admin write (USING + WITH CHECK)
drop policy if exists i18n_admin_all_uni on public.university_i18n;
create policy i18n_admin_all_uni
on public.university_i18n for all to authenticated
using (is_admin(auth.uid()))
with check (is_admin(auth.uid()));

drop policy if exists i18n_admin_all_prog on public.program_i18n;
create policy i18n_admin_all_prog
on public.program_i18n for all to authenticated
using (is_admin(auth.uid()))
with check (is_admin(auth.uid()));

-- 3) Aliases tables with trigram support
create extension if not exists pg_trgm;

create table if not exists public.university_aliases (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  lang_code text not null,
  alias text not null,
  alias_normalized text generated always as (lower(trim(alias))) stored,
  priority int not null default 0,
  source text,
  created_at timestamptz not null default now()
);

create table if not exists public.program_aliases (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  lang_code text not null,
  alias text not null,
  alias_normalized text generated always as (lower(trim(alias))) stored,
  priority int not null default 0,
  source text,
  created_at timestamptz not null default now()
);

-- Trigram indexes for fuzzy search in any language
create index if not exists idx_uni_alias_trgm
on public.university_aliases using gin (alias_normalized gin_trgm_ops);

create index if not exists idx_prog_alias_trgm
on public.program_aliases using gin (alias_normalized gin_trgm_ops);

-- 4) RLS for aliases tables
alter table public.university_aliases enable row level security;
alter table public.program_aliases enable row level security;

-- Public read
drop policy if exists aliases_public_read_uni on public.university_aliases;
create policy aliases_public_read_uni
on public.university_aliases for select to public
using (true);

drop policy if exists aliases_public_read_prog on public.program_aliases;
create policy aliases_public_read_prog
on public.program_aliases for select to public
using (true);

-- Admin all
drop policy if exists aliases_admin_all_uni on public.university_aliases;
create policy aliases_admin_all_uni
on public.university_aliases for all to authenticated
using (is_admin(auth.uid()))
with check (is_admin(auth.uid()));

drop policy if exists aliases_admin_all_prog on public.program_aliases;
create policy aliases_admin_all_prog
on public.program_aliases for all to authenticated
using (is_admin(auth.uid()))
with check (is_admin(auth.uid()));