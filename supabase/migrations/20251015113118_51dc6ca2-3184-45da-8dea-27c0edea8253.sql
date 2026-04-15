-- إضافة أعمدة is_active
alter table if exists universities add column if not exists is_active boolean default true;
alter table if exists programs add column if not exists is_active boolean default true;

-- حذف وإعادة إنشاء programs_view بالأعمدة الصحيحة
drop view if exists programs_view;

create view programs_view as
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
join universities u on u.id = p.university_id and u.is_active = true
left join degrees d on d.id = p.degree_id
left join countries c on c.id = u.country_id
where p.is_active = true;

-- جدول المنح
create table if not exists scholarships (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  university_id uuid references universities(id) on delete set null,
  country_id uuid references countries(id) on delete set null,
  degree_id uuid references degrees(id) on delete set null,
  amount numeric,
  deadline date,
  url text,
  source text,
  confidence numeric,
  status text default 'published',
  created_at timestamptz default now()
);

alter table scholarships enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='scholarships' and policyname='sch_select_all') then
    create policy sch_select_all on scholarships for select using (true);
  end if;
end $$;