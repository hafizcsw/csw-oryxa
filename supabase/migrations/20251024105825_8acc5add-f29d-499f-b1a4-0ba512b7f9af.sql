-- Complete SEO Ops schema (remaining tables)

-- GSC Configuration
create table if not exists seo_gsc_config (
  id            bigint generated always as identity primary key,
  property_url  text not null,
  svc_email     text not null,
  svc_key_pem   text not null,
  is_daily_sync boolean default false,
  is_bk_auto    boolean default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create unique index if not exists uq_seo_gsc_config on seo_gsc_config(property_url);

alter table seo_gsc_config enable row level security;
create policy seo_gsc_admin_read on seo_gsc_config for select using (is_admin(auth.uid()));
create policy seo_gsc_admin_write on seo_gsc_config for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- Backlinks table
create table if not exists seo_backlinks (
  id            bigint generated always as identity primary key,
  source_url    text not null,
  target_url    text not null,
  anchor        text,
  rel           text,
  domain        text,
  domain_rating numeric(5,2),
  first_seen    date,
  last_seen     date,
  source        text not null default 'csv',
  created_at    timestamptz default now()
);

create index if not exists ix_bk_target on seo_backlinks(target_url);
create index if not exists ix_bk_created on seo_backlinks(created_at desc);

alter table seo_backlinks enable row level security;
create policy seo_bk_admin_read on seo_backlinks for select using (is_admin(auth.uid()));
create policy seo_bk_admin_write on seo_backlinks for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- Overview summary function
create or replace function public.seo_overview_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_gsc_last timestamptz;
  v_clicks int := 0;
  v_impr int := 0;
  v_indexed int := 0;
  v_submitted int := 0;
  v_errors int := 0;
  v_warnings int := 0;
  v_total_bk int := 0;
  v_new_bk int := 0;
  v_ai_pending int := 0;
  v_ai_running int := 0;
  v_ai_done int := 0;
  v_ai_errors int := 0;
begin
  -- GSC metrics (last 30 days)
  select max(created_at) into v_gsc_last from seo_gsc_daily;
  select coalesce(sum(total_clicks), 0), coalesce(sum(total_impressions), 0)
  into v_clicks, v_impr
  from seo_gsc_daily
  where date >= current_date - interval '30 days';
  
  -- Coverage (latest)
  select coalesce(indexed, 0), coalesce(submitted, 0), coalesce(errors, 0), coalesce(warnings, 0)
  into v_indexed, v_submitted, v_errors, v_warnings
  from seo_index_coverage
  order by date desc
  limit 1;
  
  -- Backlinks
  select count(*) into v_total_bk from seo_backlinks;
  select count(*) into v_new_bk from seo_backlinks where created_at >= now() - interval '7 days';
  
  -- AI tasks
  select count(*) into v_ai_pending from seo_ai_tasks where status = 'pending';
  select count(*) into v_ai_running from seo_ai_tasks where status = 'running';
  select count(*) into v_ai_done from seo_ai_tasks where status = 'done' and created_at >= now() - interval '24 hours';
  select count(*) into v_ai_errors from seo_ai_tasks where status = 'error' and created_at >= now() - interval '24 hours';
  
  v_result := jsonb_build_object(
    'gsc', jsonb_build_object(
      'last_sync_at', v_gsc_last,
      'last30', jsonb_build_object(
        'clicks', v_clicks,
        'impressions', v_impr,
        'avg_position', 0.0,
        'avg_ctr', case when v_impr > 0 then (v_clicks::numeric / v_impr * 100) else 0 end
      )
    ),
    'coverage', jsonb_build_object(
      'indexed', v_indexed,
      'submitted', v_submitted,
      'errors', v_errors,
      'warnings', v_warnings,
      'last_updated', (select max(created_at) from seo_index_coverage)
    ),
    'backlinks', jsonb_build_object(
      'total', v_total_bk,
      'new_7d', v_new_bk,
      'ref_domains', (select count(distinct domain) from seo_backlinks where domain is not null)
    ),
    'ai', jsonb_build_object(
      'pending', v_ai_pending,
      'running', v_ai_running,
      'done_24h', v_ai_done,
      'errors_24h', v_ai_errors
    ),
    'cron', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'job_name', job_name,
        'status', status,
        'last_run_at', last_run_at
      )), '[]'::jsonb)
      from seo_cron_jobs
    )
  );
  
  return v_result;
end;
$$;

revoke all on function public.seo_overview_summary() from public;
grant execute on function public.seo_overview_summary() to authenticated;