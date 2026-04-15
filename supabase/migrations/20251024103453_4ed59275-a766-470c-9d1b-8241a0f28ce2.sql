-- فهرس خفيف لتسريع آخر الأحداث لكل اسم
create index if not exists idx_events_name_created_at
on events(name, created_at desc);

-- دالة ترجع آخر نتيجة لـ GSC وBacklinks
create or replace function public.seo_last_runs()
returns jsonb
language sql
security definer
set search_path = public
as $$
with last_gsc as (
  select created_at, properties
  from events
  where name in ('gsc_synced','gsc_sync_error','gsc_skipped')
  order by created_at desc
  limit 1
),
last_bl as (
  select created_at, properties
  from events
  where name in ('backlinks_csv_imported','backlinks_import_error','backlinks_import_skipped')
  order by created_at desc
  limit 1
)
select jsonb_build_object(
  'gsc', (
    select jsonb_build_object(
      'at', to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'props', properties
    ) from last_gsc
  ),
  'backlinks', (
    select jsonb_build_object(
      'at', to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'props', properties
    ) from last_bl
  )
);
$$;

revoke all on function public.seo_last_runs() from public;
grant execute on function public.seo_last_runs() to authenticated;