-- Foundation Gate persistence table
create table if not exists public.document_foundation_outputs (
  id uuid primary key default gen_random_uuid(),
  document_id text not null,
  user_id uuid not null,
  route_family text not null,
  route_confidence numeric not null default 0,
  selected_lane text not null,
  requires_review boolean not null default false,
  processing_state text not null,
  privacy_blocked boolean not null default false,
  route_reasons jsonb not null default '[]'::jsonb,
  router_version text not null,
  review_status text not null,
  review_reason jsonb not null default '[]'::jsonb,
  normalized_document jsonb not null default '{}'::jsonb,
  route_decision jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_foundation_outputs_document_id_unique unique (document_id)
);

create index if not exists idx_dfo_user on public.document_foundation_outputs(user_id);
create index if not exists idx_dfo_lane on public.document_foundation_outputs(selected_lane);
create index if not exists idx_dfo_review on public.document_foundation_outputs(requires_review) where requires_review = true;

alter table public.document_foundation_outputs enable row level security;

create policy "Users view their own foundation rows"
  on public.document_foundation_outputs for select
  using (auth.uid() = user_id);

create policy "Users insert their own foundation rows"
  on public.document_foundation_outputs for insert
  with check (auth.uid() = user_id);

create policy "Users update their own foundation rows"
  on public.document_foundation_outputs for update
  using (auth.uid() = user_id);

create policy "Users delete their own foundation rows"
  on public.document_foundation_outputs for delete
  using (auth.uid() = user_id);

-- updated_at trigger (reuses the project's standard function if present)
do $$ begin
  if exists (select 1 from pg_proc where proname = 'update_updated_at_column') then
    create trigger trg_dfo_updated_at
      before update on public.document_foundation_outputs
      for each row execute function public.update_updated_at_column();
  end if;
end $$;