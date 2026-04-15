-- LAV #14: Compare & Shortlist UX enhancements (Fixed)

-- 1) Application deadline reminders table
create table if not exists application_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(user_id) on delete cascade,
  program_id uuid not null references programs(id) on delete cascade,
  remind_at timestamptz not null,
  sent boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_reminders_user on application_reminders(user_id, remind_at);
create index if not exists idx_reminders_pending on application_reminders(remind_at) where not sent;

-- RLS for reminders
alter table application_reminders enable row level security;

create policy "Users can view their own reminders"
  on application_reminders for select
  using (auth.uid() = user_id);

create policy "Users can create their own reminders"
  on application_reminders for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own reminders"
  on application_reminders for delete
  using (auth.uid() = user_id);

-- 2) Enable realtime for user_shortlists
alter publication supabase_realtime add table user_shortlists;

-- 3) Function to get upcoming deadlines for user's shortlist (Fixed)
create or replace function get_upcoming_deadlines(p_user_id uuid)
returns table(
  program_id uuid,
  title text,
  university_name text,
  next_intake text,
  days_remaining int
)
language sql
stable
security definer
set search_path = public
as $$
  select 
    p.id as program_id,
    p.title,
    u.name as university_name,
    p.next_intake,
    null::int as days_remaining
  from user_shortlists us
  join programs p on p.id = us.program_id
  join universities u on u.id = p.university_id
  where us.user_id = p_user_id
    and p.next_intake is not null
  order by p.next_intake asc
  limit 10;
$$;