
-- ============================================================
-- Identity Activation + Website Support tables
-- pkivavsxbvwtnkgxaufa (portal-side mirror of CRM Internal Ops)
-- ============================================================

-- Enums
do $$ begin
  create type public.identity_doc_kind as enum ('passport','national_id','driver_license');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.identity_status as enum ('none','pending','approved','rejected','reupload_required');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.identity_reader_verdict as enum ('accepted_preliminarily','weak','unsupported');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.support_ticket_status as enum ('open','in_progress','resolved','closed');
exception when duplicate_object then null; end $$;

-- ─── Identity activations ────────────────────────────────────
create table if not exists public.identity_activations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  doc_kind public.identity_doc_kind not null,
  doc_storage_path text not null,
  selfie_storage_path text not null,
  video_storage_path text not null,
  reader_verdict public.identity_reader_verdict not null,
  reader_payload jsonb not null default '{}'::jsonb,
  status public.identity_status not null default 'pending',
  decision_reason_code text,
  reupload_required_fields text[],
  decided_at timestamptz,
  decided_by uuid,
  client_trace_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_identity_activations_user on public.identity_activations(user_id, created_at desc);

alter table public.identity_activations enable row level security;

drop policy if exists "user can read own identity activations" on public.identity_activations;
create policy "user can read own identity activations"
  on public.identity_activations for select
  using (auth.uid() = user_id);

-- inserts/updates only via service role (edge function). No user-facing insert policy.

-- ─── Identity status mirror (latest only, fast read) ─────────
create table if not exists public.identity_status_mirror (
  user_id uuid primary key,
  status public.identity_status not null default 'none',
  last_activation_id uuid references public.identity_activations(id) on delete set null,
  decision_reason_code text,
  reupload_required_fields text[],
  blocks_academic_file boolean not null default true,
  decided_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.identity_status_mirror enable row level security;

drop policy if exists "user can read own identity mirror" on public.identity_status_mirror;
create policy "user can read own identity mirror"
  on public.identity_status_mirror for select
  using (auth.uid() = user_id);

-- ─── Support tickets ─────────────────────────────────────────
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  subject_key text,
  body text not null,
  attachment_storage_path text,
  origin text not null default 'portal_account',
  status public.support_ticket_status not null default 'open',
  last_reply_at timestamptz,
  client_trace_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_support_tickets_user on public.support_tickets(user_id, created_at desc);

alter table public.support_tickets enable row level security;

drop policy if exists "user can read own tickets" on public.support_tickets;
create policy "user can read own tickets"
  on public.support_tickets for select
  using (auth.uid() = user_id);

drop policy if exists "user can create own tickets" on public.support_tickets;
create policy "user can create own tickets"
  on public.support_tickets for insert
  with check (auth.uid() = user_id);

-- updates only via service role (CRM ops sync) — no user update policy.

-- ─── updated_at triggers ─────────────────────────────────────
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_identity_activations_updated on public.identity_activations;
create trigger trg_identity_activations_updated
before update on public.identity_activations
for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_identity_mirror_updated on public.identity_status_mirror;
create trigger trg_identity_mirror_updated
before update on public.identity_status_mirror
for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_support_tickets_updated on public.support_tickets;
create trigger trg_support_tickets_updated
before update on public.support_tickets
for each row execute function public.tg_set_updated_at();

-- ─── Mirror upsert trigger (when an activation is created/updated, refresh mirror) ───
create or replace function public.tg_sync_identity_mirror()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.identity_status_mirror as m (
    user_id, status, last_activation_id, decision_reason_code,
    reupload_required_fields, blocks_academic_file, decided_at
  )
  values (
    new.user_id,
    new.status,
    new.id,
    new.decision_reason_code,
    new.reupload_required_fields,
    (new.status <> 'approved'),
    new.decided_at
  )
  on conflict (user_id) do update set
    status = excluded.status,
    last_activation_id = excluded.last_activation_id,
    decision_reason_code = excluded.decision_reason_code,
    reupload_required_fields = excluded.reupload_required_fields,
    blocks_academic_file = excluded.blocks_academic_file,
    decided_at = excluded.decided_at,
    updated_at = now();
  return new;
end $$;

drop trigger if exists trg_sync_identity_mirror on public.identity_activations;
create trigger trg_sync_identity_mirror
after insert or update on public.identity_activations
for each row execute function public.tg_sync_identity_mirror();

-- ─── Storage bucket: identity-activation (private) ───────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'identity-activation',
  'identity-activation',
  false,
  16777216, -- 16MB cap (covers 15MB video + headroom)
  array[
    'image/jpeg','image/png','image/webp','application/pdf',
    'video/mp4','video/quicktime'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies: user can only access their own folder (path prefix = auth.uid())
drop policy if exists "identity-activation owner read" on storage.objects;
create policy "identity-activation owner read"
  on storage.objects for select
  using (
    bucket_id = 'identity-activation'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "identity-activation owner insert" on storage.objects;
create policy "identity-activation owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'identity-activation'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "identity-activation owner update" on storage.objects;
create policy "identity-activation owner update"
  on storage.objects for update
  using (
    bucket_id = 'identity-activation'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
