-- LAV #11: Go-Live Hardening

-- 1. Extend settings table
alter table settings add column if not exists site_readonly boolean default false;
alter table settings add column if not exists contact_email text;
alter table settings add column if not exists contact_whatsapp text;
alter table settings add column if not exists contact_address text;

-- 2. Email templates table
create table if not exists email_templates (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  subject text not null,
  body text not null,
  variables text[] default array[]::text[],
  is_active boolean default true,
  created_at timestamptz default now()
);
alter table email_templates enable row level security;
create policy "et_public_read" on email_templates for select using (true);

-- Insert default email templates
insert into email_templates(key, name, subject, body, variables) values
  ('application_received', 'Application Received', 'Your application has been received', 'Hi {{name}}, we have received your application. Application ID: {{application_id}}', array['name','application_id']),
  ('doc_uploaded', 'Document Uploaded', 'Document uploaded successfully', 'Hi {{name}}, your document has been uploaded successfully.', array['name']),
  ('status_updated', 'Status Update', 'Application status updated', 'Hi {{name}}, your application status has been updated to: {{status}}', array['name','status'])
on conflict (key) do nothing;

-- 3. Abuse protection: daily limit per visitor
create index if not exists idx_applications_visitor_created 
  on applications(visitor_id, created_at desc) 
  where status != 'rejected';

-- Function to check daily application limit
create or replace function check_daily_application_limit(p_visitor_id text)
returns boolean language sql stable as $$
  select count(*) < 3
  from applications
  where visitor_id = p_visitor_id
    and created_at > now() - interval '24 hours'
    and status != 'rejected';
$$;

-- 4. Event throttle index
create index if not exists idx_events_throttle 
  on events(visitor_id, name, created_at desc);

-- 5. Extend notifications for email channel
alter table notifications add column if not exists subject text;
create index if not exists idx_notifications_channel_status 
  on notifications(channel, status, created_at desc);

-- 6. Read-only mode check function
create or replace function is_site_readonly()
returns boolean language sql stable as $$
  select coalesce((select site_readonly from settings where id = true limit 1), false);
$$;