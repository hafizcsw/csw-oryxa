-- جدول لربط الهاتف بـ visitor_id (توحيد قنوات الويب والواتساب)
create table if not exists phone_identities (
  phone text primary key,
  visitor_id text not null,
  created_at timestamptz default now()
);

alter table phone_identities enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='phone_identities' and policyname='pi_select_all') then
    create policy pi_select_all on phone_identities for select using (true);
  end if;
end $$;