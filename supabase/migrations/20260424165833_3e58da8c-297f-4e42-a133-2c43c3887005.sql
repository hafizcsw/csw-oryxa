-- ═══════════════════════════════════════════════════════════════
-- Order 2: Portal Draft Layer
-- ═══════════════════════════════════════════════════════════════

-- 1) Bucket
insert into storage.buckets (id, name, public)
values ('portal-drafts', 'portal-drafts', false)
on conflict (id) do nothing;

-- 2) Table
create table if not exists public.portal_document_drafts (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null,
  document_type text,
  original_file_name text not null,
  mime_type text,
  file_size bigint,
  file_sha256 text,
  draft_storage_bucket text not null default 'portal-drafts',
  draft_storage_path text not null,
  status text not null,
  extraction_status text not null default 'not_started',
  identity_match_status text not null default 'not_checked',
  evaluation_status text not null default 'not_started',
  source_surface text,
  trace_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  confirmed_at timestamptz,
  discarded_at timestamptz,
  shared_to_crm_at timestamptz,
  constraint portal_document_drafts_status_check check (
    status in (
      'selected_local',
      'portal_draft_uploaded',
      'awaiting_extraction',
      'discarded_by_student',
      'expired_draft',
      'shared_to_crm'
    )
  )
);

create index if not exists portal_document_drafts_student_idx
  on public.portal_document_drafts (student_user_id, created_at desc);

create index if not exists portal_document_drafts_active_idx
  on public.portal_document_drafts (student_user_id)
  where discarded_at is null and shared_to_crm_at is null;

-- updated_at trigger
create or replace function public.tg_portal_document_drafts_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists portal_document_drafts_touch on public.portal_document_drafts;
create trigger portal_document_drafts_touch
before update on public.portal_document_drafts
for each row
execute function public.tg_portal_document_drafts_touch();

-- 3) RLS on table
alter table public.portal_document_drafts enable row level security;

drop policy if exists "drafts_owner_select" on public.portal_document_drafts;
create policy "drafts_owner_select"
on public.portal_document_drafts
for select
to authenticated
using (auth.uid() = student_user_id);

drop policy if exists "drafts_owner_insert" on public.portal_document_drafts;
create policy "drafts_owner_insert"
on public.portal_document_drafts
for insert
to authenticated
with check (auth.uid() = student_user_id);

drop policy if exists "drafts_owner_update" on public.portal_document_drafts;
create policy "drafts_owner_update"
on public.portal_document_drafts
for update
to authenticated
using (auth.uid() = student_user_id)
with check (auth.uid() = student_user_id);

drop policy if exists "drafts_owner_delete" on public.portal_document_drafts;
create policy "drafts_owner_delete"
on public.portal_document_drafts
for delete
to authenticated
using (auth.uid() = student_user_id);

-- 4) Storage RLS for portal-drafts bucket
-- path layout: study-file/{auth.uid}/{draft_id}/{filename}
-- => foldername(name)[1] = 'study-file', [2] = auth.uid()::text

drop policy if exists "portal_drafts_owner_select" on storage.objects;
create policy "portal_drafts_owner_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'portal-drafts'
  and (storage.foldername(name))[1] = 'study-file'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "portal_drafts_owner_insert" on storage.objects;
create policy "portal_drafts_owner_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'portal-drafts'
  and (storage.foldername(name))[1] = 'study-file'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "portal_drafts_owner_update" on storage.objects;
create policy "portal_drafts_owner_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'portal-drafts'
  and (storage.foldername(name))[1] = 'study-file'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "portal_drafts_owner_delete" on storage.objects;
create policy "portal_drafts_owner_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'portal-drafts'
  and (storage.foldername(name))[1] = 'study-file'
  and (storage.foldername(name))[2] = auth.uid()::text
);