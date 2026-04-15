
-- Add traffic classification columns to events table
ALTER TABLE public.events 
  ADD COLUMN IF NOT EXISTS hostname text,
  ADD COLUMN IF NOT EXISTS environment text DEFAULT 'prod',
  ADD COLUMN IF NOT EXISTS traffic_class text DEFAULT 'real',
  ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_staff boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_test boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS trace_tag text;

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_events_traffic_class ON public.events(traffic_class);
CREATE INDEX IF NOT EXISTS idx_events_hostname ON public.events(hostname);
CREATE INDEX IF NOT EXISTS idx_events_environment ON public.events(environment);

-- Backfill: mark known synthetic/test visitor_ids
UPDATE public.events SET 
  traffic_class = 'synthetic',
  is_test = true,
  environment = 'test'
WHERE visitor_id IN ('synth-test-001', 'v5-blend-test', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01', 'test');

-- Backfill: mark top-4 heavy-hitter dev visitors (52% of all traffic, clearly dev/admin)
-- c1b2fb2f has 7361 auth_signed_in events - clearly admin
UPDATE public.events SET
  traffic_class = 'internal',
  is_admin = true
WHERE visitor_id = 'c1b2fb2f-850c-4682-8a74-e2da76e54f88';

-- 3f9d410a has 518 auth_signed_in - clearly staff/admin
UPDATE public.events SET
  traffic_class = 'internal',
  is_staff = true
WHERE visitor_id = '3f9d410a-b97b-477e-93f0-9b89978f66c0';

-- Now rebuild decision_analytics to filter by traffic_class
CREATE OR REPLACE FUNCTION public.decision_analytics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  _overview jsonb;
  _funnel jsonb;
  _engagement jsonb;
  _uni_intel jsonb;
  _search_intel jsonb;
  _content_gaps jsonb;
BEGIN
  -- ============ TRAFFIC FILTER: only real traffic ============
  -- Exclude: synthetic, internal, dev, seed, bot, test
  -- Also exclude known preview hostnames

  -- ============ OVERVIEW ============
  SELECT jsonb_build_object(
    'visitors_24h', count(distinct visitor_id) filter(where e.created_at >= now() - interval '24 hours'),
    'visitors_7d', count(distinct visitor_id) filter(where e.created_at >= now() - interval '7 days'),
    'visitors_30d', count(distinct visitor_id) filter(where e.created_at >= now() - interval '30 days'),
    'active_now', count(distinct visitor_id) filter(where e.created_at >= now() - interval '5 minutes'),
    'pageviews_24h', count(*) filter(where e.name = 'page_view' and e.created_at >= now() - interval '24 hours'),
    'pageviews_7d', count(*) filter(where e.name = 'page_view' and e.created_at >= now() - interval '7 days'),
    'pageviews_30d', count(*) filter(where e.name = 'page_view' and e.created_at >= now() - interval '30 days'),
    'registrations_24h', (select count(*) from profiles where created_at >= now() - interval '24 hours'),
    'registrations_7d', (select count(*) from profiles where created_at >= now() - interval '7 days'),
    'registrations_30d', (select count(*) from profiles where created_at >= now() - interval '30 days'),
    'shortlist_adds_24h', count(*) filter(where e.name in ('shortlist_add','shortlist_added') and e.created_at >= now() - interval '24 hours'),
    'shortlist_adds_7d', count(*) filter(where e.name in ('shortlist_add','shortlist_added') and e.created_at >= now() - interval '7 days'),
    'shortlist_adds_30d', count(*) filter(where e.name in ('shortlist_add','shortlist_added') and e.created_at >= now() - interval '30 days'),
    'application_starts_24h', (select count(*) from applications where created_at >= now() - interval '24 hours'),
    'application_starts_7d', (select count(*) from applications where created_at >= now() - interval '7 days'),
    'doc_uploads_24h', (select count(*) from application_documents where created_at >= now() - interval '24 hours'),
    'doc_uploads_7d', (select count(*) from application_documents where created_at >= now() - interval '7 days'),
    'chat_sessions_24h', count(distinct session_id) filter(where e.name = 'page_view' and e.created_at >= now() - interval '24 hours'),
    'chat_sessions_7d', count(distinct session_id) filter(where e.name = 'page_view' and e.created_at >= now() - interval '7 days'),
    'returning_visitors_pct', 0,
    'avg_engaged_time_sec', coalesce((
      select avg((e2.properties->>'engaged_seconds')::numeric)
      from events e2
      where e2.name = 'engaged_time_heartbeat'
        and e2.created_at >= now() - interval '7 days'
        and e2.traffic_class = 'real'
    ), 0),
    'engaged_time_source', 'heartbeat',
    'daily_trend', coalesce((
      select jsonb_agg(row_to_json(t) order by t.day)
      from (
        select e2.created_at::date as day,
               count(distinct e2.visitor_id) as visitors,
               count(*) filter(where e2.name = 'page_view') as pageviews
        from events e2
        where e2.created_at >= now() - interval '30 days'
          and e2.traffic_class = 'real'
          and e2.is_admin = false
          and e2.is_test = false
        group by 1
      ) t
    ), '[]'::jsonb),
    'traffic_filter', 'real_only',
    'excluded_classes', jsonb_build_array('synthetic','internal','dev','seed','bot')
  ) INTO _overview
  FROM events e
  WHERE e.created_at >= now() - interval '30 days'
    AND e.traffic_class = 'real'
    AND e.is_admin = false
    AND e.is_test = false;

  -- ============ FUNNEL ============
  SELECT coalesce(jsonb_agg(row_to_json(f) order by f.step_order), '[]'::jsonb) INTO _funnel
  FROM (
    SELECT 'landing' as step, 1 as step_order,
      count(distinct visitor_id) as visitors,
      'visitor_id' as identity_domain
    FROM events WHERE name = 'page_view' AND route = '/'
      AND created_at >= now() - interval '30 days'
      AND traffic_class = 'real' AND is_admin = false AND is_test = false
    UNION ALL
    SELECT 'search', 2,
      count(distinct visitor_id),
      'visitor_id'
    FROM events WHERE name in ('search_performed','page_view') AND (name = 'search_performed' OR route = '/search')
      AND created_at >= now() - interval '30 days'
      AND traffic_class = 'real' AND is_admin = false AND is_test = false
    UNION ALL
    SELECT 'university_view', 3,
      count(distinct visitor_id),
      'visitor_id'
    FROM events WHERE (name = 'entity_view' AND properties->>'entity_type' = 'university')
      OR (name = 'page_view' AND route like '/universities/%')
      AND created_at >= now() - interval '30 days'
      AND traffic_class = 'real' AND is_admin = false AND is_test = false
    UNION ALL
    SELECT 'program_view', 4,
      count(distinct visitor_id),
      'visitor_id'
    FROM events WHERE (name = 'entity_view' AND properties->>'entity_type' = 'program')
      OR (name = 'page_view' AND route like '/programs/%')
      AND created_at >= now() - interval '30 days'
      AND traffic_class = 'real' AND is_admin = false AND is_test = false
    UNION ALL
    SELECT 'shortlist', 5,
      count(distinct visitor_id),
      'visitor_id'
    FROM events WHERE name in ('shortlist_add','shortlist_added')
      AND created_at >= now() - interval '30 days'
      AND traffic_class = 'real' AND is_admin = false AND is_test = false
    UNION ALL
    SELECT 'register_start', 6,
      count(distinct visitor_id),
      'visitor_id'
    FROM events WHERE name = 'register_start'
      AND created_at >= now() - interval '30 days'
      AND traffic_class = 'real' AND is_admin = false AND is_test = false
    UNION ALL
    SELECT 'register_complete', 7,
      (select count(*) from profiles where created_at >= now() - interval '30 days'),
      'user_id'
    UNION ALL
    SELECT 'apply_click', 8,
      (select count(distinct user_id) from applications where created_at >= now() - interval '30 days'),
      'user_id'
    UNION ALL
    SELECT 'doc_upload', 9,
      (select count(distinct a.user_id) from application_documents ad join applications a on a.id = ad.application_id where ad.created_at >= now() - interval '30 days'),
      'user_id'
    UNION ALL
    SELECT 'payment', 10, 0, 'user_id'
  ) f;

  -- ============ ENGAGEMENT ============
  SELECT jsonb_build_object(
    'top_pages_by_views', coalesce((
      select jsonb_agg(row_to_json(t) order by t.views desc)
      from (
        select route as page_route, count(*) as views, count(distinct visitor_id) as unique_visitors
        from events where name = 'page_view' and route is not null
          and created_at >= now() - interval '30 days'
          and traffic_class = 'real' and is_admin = false and is_test = false
        group by 1 order by 2 desc limit 10
      ) t
    ), '[]'::jsonb),
    'top_exit_pages', '[]'::jsonb,
    'device_breakdown', '[]'::jsonb,
    'hourly_pattern', coalesce((
      select jsonb_agg(row_to_json(t) order by t.hr)
      from (
        select extract(hour from created_at) as hr, count(distinct visitor_id) as visitors
        from events where name = 'page_view'
          and created_at >= now() - interval '7 days'
          and traffic_class = 'real' and is_admin = false and is_test = false
        group by 1
      ) t
    ), '[]'::jsonb),
    'bounce_rate', 0,
    'bounce_basis', 'not_calculated'
  ) INTO _engagement;

  -- ============ UNIVERSITY INTEL (per-slug blending) ============
  SELECT jsonb_build_object(
    'top_by_views', coalesce((
      select jsonb_agg(row_to_json(t) order by t.views desc)
      from (
        with entity_views as (
          select properties->>'entity_slug' as slug, visitor_id
          from events
          where name = 'entity_view' and properties->>'entity_type' = 'university'
            and created_at >= now() - interval '30 days'
            and traffic_class = 'real' and is_admin = false and is_test = false
        ),
        route_views as (
          select replace(route, '/universities/', '') as slug, visitor_id
          from events
          where name = 'page_view' and route like '/universities/%' and route not like '/universities/%/%'
            and created_at >= now() - interval '30 days'
            and traffic_class = 'real' and is_admin = false and is_test = false
            and not exists (
              select 1 from entity_views ev
              where ev.slug = replace(events.route, '/universities/', '')
                and ev.visitor_id = events.visitor_id
            )
        ),
        combined as (
          select slug, visitor_id from entity_views
          union all
          select slug, visitor_id from route_views
        )
        select
          coalesce(u.name_ar, c.slug) as name_ar,
          coalesce(u.name_en, c.slug) as name_en,
          c.slug,
          count(*) as views,
          count(distinct c.visitor_id) as unique_visitors
        from combined c
        left join universities u on u.slug = c.slug
        where c.slug is not null and c.slug != ''
        group by c.slug, u.name_ar, u.name_en
        order by views desc limit 10
      ) t
    ), '[]'::jsonb),
    'top_by_shortlist', coalesce((
      select jsonb_agg(row_to_json(t) order by t.adds desc)
      from (
        select coalesce(u.name_ar,'') as name_ar, coalesce(u.name_en,'') as name_en,
          '' as slug, properties->>'entity_id' as entity_id,
          count(*) as adds, count(distinct visitor_id) as unique_users
        from events
        left join universities u on u.id::text = events.properties->>'entity_id'
        where name in ('shortlist_add','shortlist_added')
          and created_at >= now() - interval '30 days'
          and traffic_class = 'real' and is_admin = false and is_test = false
        group by properties->>'entity_id', u.name_ar, u.name_en
        limit 10
      ) t
    ), '[]'::jsonb),
    'top_programs_by_views', coalesce((
      select jsonb_agg(row_to_json(t) order by t.views desc)
      from (
        with entity_views as (
          select properties->>'entity_slug' as slug, visitor_id
          from events
          where name = 'entity_view' and properties->>'entity_type' = 'program'
            and created_at >= now() - interval '30 days'
            and traffic_class = 'real' and is_admin = false and is_test = false
        ),
        route_views as (
          select replace(route, '/programs/', '') as slug, visitor_id
          from events
          where name = 'page_view' and route like '/programs/%'
            and created_at >= now() - interval '30 days'
            and traffic_class = 'real' and is_admin = false and is_test = false
            and not exists (
              select 1 from entity_views ev
              where ev.slug = replace(events.route, '/programs/', '')
                and ev.visitor_id = events.visitor_id
            )
        ),
        combined as (
          select slug, visitor_id from entity_views
          union all
          select slug, visitor_id from route_views
        )
        select
          coalesce(p.title, c.slug) as program_title,
          '' as university_name,
          c.slug as prog_slug,
          count(*) as views,
          count(distinct c.visitor_id) as unique_visitors
        from combined c
        left join programs p on p.slug = c.slug
        where c.slug is not null and c.slug != ''
        group by c.slug, p.title
        order by views desc limit 10
      ) t
    ), '[]'::jsonb),
    'data_source', 'blended_entity_and_route_per_slug'
  ) INTO _uni_intel;

  -- ============ SEARCH INTEL ============
  SELECT jsonb_build_object(
    'top_country_filters', coalesce((
      select jsonb_agg(row_to_json(t))
      from (
        select properties->>'country' as filter_val, count(*) as uses, count(distinct visitor_id) as unique_users
        from events where name = 'search_performed' and properties->>'country' is not null
          and created_at >= now() - interval '30 days'
          and traffic_class = 'real' and is_admin = false and is_test = false
        group by 1 order by 2 desc limit 10
      ) t
    ), '[]'::jsonb),
    'top_degree_filters', coalesce((
      select jsonb_agg(row_to_json(t))
      from (
        select properties->>'degree' as filter_val, count(*) as uses
        from events where name = 'search_performed' and properties->>'degree' is not null
          and created_at >= now() - interval '30 days'
          and traffic_class = 'real' and is_admin = false and is_test = false
        group by 1 order by 2 desc limit 10
      ) t
    ), '[]'::jsonb),
    'search_to_click_pct', coalesce((
      select round(
        count(distinct visitor_id) filter(where name = 'search_result_click')::numeric /
        nullif(count(distinct visitor_id) filter(where name = 'search_performed'), 0) * 100, 1
      )
      from events where name in ('search_performed','search_result_click')
        and created_at >= now() - interval '30 days'
        and traffic_class = 'real' and is_admin = false and is_test = false
    ), 0),
    'search_to_shortlist_pct', 0,
    'total_searches_30d', (
      select count(*) from events where name = 'search_performed'
        and created_at >= now() - interval '30 days'
        and traffic_class = 'real' and is_admin = false and is_test = false
    ),
    'attribution_method', 'visitor_id_unified'
  ) INTO _search_intel;

  -- ============ CONTENT GAPS ============
  SELECT jsonb_build_object(
    'universities_missing_tuition', coalesce((
      select jsonb_agg(row_to_json(t) order by t.views desc)
      from (
        select u.name_ar, u.slug, count(*) as views
        from events e
        join universities u on u.slug = replace(e.route, '/universities/', '')
        where e.name = 'page_view' and e.route like '/universities/%'
          and e.created_at >= now() - interval '30 days'
          and e.traffic_class = 'real' and e.is_admin = false and e.is_test = false
          and not exists (
            select 1 from programs p where p.university_id = u.id and p.tuition_fees_usd is not null
          )
        group by u.name_ar, u.slug
        having count(*) >= 2
        order by 3 desc limit 10
      ) t
    ), '[]'::jsonb),
    'programs_missing_deadlines', '[]'::jsonb,
    'high_traffic_incomplete', '[]'::jsonb
  ) INTO _content_gaps;

  -- ============ ASSEMBLE ============
  result := jsonb_build_object(
    'overview', _overview,
    'funnel', _funnel,
    'engagement', _engagement,
    'university_intel', _uni_intel,
    'search_intel', _search_intel,
    'content_gaps', _content_gaps,
    'generated_at', now()
  );

  RETURN result;
END;
$$;
