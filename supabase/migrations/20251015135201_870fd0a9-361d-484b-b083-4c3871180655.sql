-- LAV #11: Accounts & Identity System

-- 1. Profiles table (mirror for Supabase Auth)
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "profiles_self" on profiles for select using (auth.uid() = user_id);
create policy "profiles_self_upd" on profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "profiles_self_ins" on profiles for insert with check (auth.uid() = user_id);

-- Trigger to auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- 2. Link visitors to accounts
alter table phone_identities add column if not exists user_id uuid references profiles(user_id) on delete set null;
create index if not exists idx_phone_identities_user on phone_identities(user_id);

alter table chat_sessions add column if not exists user_id uuid references profiles(user_id) on delete set null;
alter table applications add column if not exists user_id uuid references profiles(user_id) on delete set null;

-- 3. User shortlists (favorites stored in DB)
create table if not exists user_shortlists (
  user_id uuid not null references profiles(user_id) on delete cascade,
  program_id uuid not null references programs(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, program_id)
);
alter table user_shortlists enable row level security;
create policy "shortlist_self" on user_shortlists for select using (auth.uid() = user_id);
create policy "shortlist_self_ins" on user_shortlists for insert with check (auth.uid() = user_id);
create policy "shortlist_self_del" on user_shortlists for delete using (auth.uid() = user_id);

-- 4. Helper function: link visitor data to user
create or replace function link_visitor_to_user(p_visitor text, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update chat_sessions set user_id = p_user where visitor_id = p_visitor and user_id is null;
  update applications set user_id = p_user where visitor_id = p_visitor and user_id is null;
  update phone_identities set user_id = p_user where visitor_id = p_visitor and user_id is null;
  
  -- Log integration event
  insert into integration_events(event_name, target, payload, idempotency_key, status)
  values (
    'user.linked',
    'crm',
    jsonb_build_object('user_id', p_user, 'visitor_id', p_visitor),
    'user_link:' || p_user || ':' || p_visitor,
    'queued'
  ) on conflict (idempotency_key) do nothing;
end $$;

-- 5. Update timestamp trigger for profiles
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger update_profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();