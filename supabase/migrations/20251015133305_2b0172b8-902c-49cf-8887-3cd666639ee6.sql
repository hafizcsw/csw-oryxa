-- 1. جدول أحداث الحالة لكل طلب
create table if not exists application_status_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  status text not null check (status in ('new','in_review','submitted','rejected','accepted','docs_required')),
  note text,
  channel text default 'system',
  created_by text,
  created_at timestamptz not null default now()
);

alter table application_status_events enable row level security;

create policy "ase_public_read" on application_status_events
  for select using (true);

create index if not exists idx_ase_app_time on application_status_events(application_id, created_at desc);

-- 2. جدول التنبيهات العام (واتساب/إيميل/موقع)
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  visitor_id text,
  application_id uuid references applications(id) on delete cascade,
  channel text not null check (channel in ('whatsapp','email','site')),
  template_key text not null,
  payload jsonb,
  status text not null default 'queued',
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table notifications enable row level security;

create policy "notif_public_read" on notifications 
  for select using (true);

create index if not exists idx_notifications_status_time on notifications(status, created_at desc);
create index if not exists idx_notifications_app on notifications(application_id);

-- 3. وظيفة توحيد إضافة حالة + صف تنبيه + حدث تكامل
create or replace function app_add_status(
  p_application_id uuid, 
  p_status text, 
  p_note text, 
  p_created_by text
)
returns void 
language plpgsql 
security definer
set search_path = public
as $$
declare
  v_visitor text;
  v_phone text;
begin
  -- تحديث حالة الطلب الرئيسية
  update applications
     set status = p_status
   where id = p_application_id;

  -- إضافة حدث في خط الزمن
  insert into application_status_events(application_id, status, note, created_by)
  values (p_application_id, p_status, p_note, coalesce(p_created_by, 'system'));

  -- ربط الزائر/الهاتف
  select visitor_id into v_visitor from applications where id = p_application_id;
  if v_visitor is not null then
    select phone into v_phone from phone_identities where visitor_id = v_visitor limit 1;

    -- صف تنبيه واتساب
    if v_phone is not null then
      insert into notifications(visitor_id, application_id, channel, template_key, payload)
      values (v_visitor, p_application_id, 'whatsapp', 'application_status_update',
              jsonb_build_object('status', p_status, 'note', p_note, 'phone', v_phone));
    end if;
  end if;

  -- اصطفاف حدث تكامل للـ CRM
  insert into integration_events(event_name, target, payload, idempotency_key, status)
  values ('application.status_changed', 'crm',
          jsonb_build_object('application_id', p_application_id, 'status', p_status, 'note', p_note),
          'app_status:'||p_application_id||':'||p_status||':'||to_char(now(),'YYYYMMDDHH24MI'),
          'queued')
  on conflict (idempotency_key) do nothing;
end $$;