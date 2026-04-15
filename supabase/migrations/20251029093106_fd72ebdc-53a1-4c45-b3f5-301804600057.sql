-- 1) جدول التوكنات المؤقتة لبوابة الطالب
create table if not exists public.portal_tokens (
  token uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(user_id) on delete cascade,
  issued_by uuid null,
  expires_at timestamptz not null default now() + interval '72 hours',
  consumed_at timestamptz null,
  created_at timestamptz not null default now()
);
create index if not exists idx_portal_tokens_profile on public.portal_tokens(profile_id);
create index if not exists idx_portal_tokens_exp on public.portal_tokens(expires_at);

-- Enable RLS
alter table public.portal_tokens enable row level security;

-- 2) أعمدة تقدم الطالب في profiles
alter table public.profiles
  add column if not exists student_substage text,
  add column if not exists student_progress smallint;

-- 3) دالة استرجاع بروفايل الطالب عبر الجلسة
create or replace function public.rpc_student_profile_by_session()
returns public.profiles
language sql
security definer
set search_path = public
as $$
  select p.*
  from public.profiles p
  where p.user_id = auth.uid()
  limit 1
$$;
grant execute on function public.rpc_student_profile_by_session() to authenticated;

-- 4) تحويل المرحلة إلى نسبة تقدّم
create or replace function public.fn_student_progress_from_substage(s text)
returns smallint language sql immutable as $$
select case
  when $1='collecting_docs' then 0
  when $1='docs_review' then 11
  when $1='docs_approved' then 22
  when $1='payment_pending' then 33
  when $1='partially_paid' then 44
  when $1='fully_paid' then 55
  when $1='ready_to_submit' then 66
  when $1='submitted' then 77
  when $1='offer_received' then 88
  when $1='offer_accepted' then 100
  else null
end::smallint $$;

-- 5) Trigger لتحديث التقدم تلقائياً
create or replace function public.trg_profiles_set_progress()
returns trigger language plpgsql as $$
begin
  if TG_OP='INSERT' then
    new.student_progress := coalesce(new.student_progress, public.fn_student_progress_from_substage(new.student_substage));
  elsif TG_OP='UPDATE' then
    if new.student_substage is distinct from old.student_substage then
      new.student_progress := public.fn_student_progress_from_substage(new.student_substage);
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists profiles_set_progress on public.profiles;
create trigger profiles_set_progress
before insert or update of student_substage on public.profiles
for each row execute function public.trg_profiles_set_progress();