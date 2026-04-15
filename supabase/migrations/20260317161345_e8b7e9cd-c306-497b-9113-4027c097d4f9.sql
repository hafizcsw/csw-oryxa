
-- Fix: use tuition_usd_min instead of tuition_fees_usd
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
  _cutover timestamptz := '2026-03-17T16:00:00Z';
BEGIN

  SELECT jsonb_build_object(
    'visitors_24h', count(distinct ev.visitor_id) filter(where ev.created_at >= now() - interval '24 hours'),
    'visitors_7d', count(distinct ev.visitor_id) filter(where ev.created_at >= now() - interval '7 days'),
    'visitors_30d', count(distinct ev.visitor_id) filter(where ev.created_at >= now() - interval '30 days'),
    'active_now', count(distinct ev.visitor_id) filter(where ev.created_at >= now() - interval '5 minutes'),
    'pageviews_24h', count(*) filter(where ev.name = 'page_view' and ev.created_at >= now() - interval '24 hours'),
    'pageviews_7d', count(*) filter(where ev.name = 'page_view' and ev.created_at >= now() - interval '7 days'),
    'pageviews_30d', count(*) filter(where ev.name = 'page_view' and ev.created_at >= now() - interval '30 days'),
    'registrations_24h', (select count(*) from profiles where created_at >= now() - interval '24 hours'),
    'registrations_7d', (select count(*) from profiles where created_at >= now() - interval '7 days'),
    'registrations_30d', (select count(*) from profiles where created_at >= now() - interval '30 days'),
    'shortlist_adds_24h', count(*) filter(where ev.name in ('shortlist_add','shortlist_added') and ev.created_at >= now() - interval '24 hours'),
    'shortlist_adds_7d', count(*) filter(where ev.name in ('shortlist_add','shortlist_added') and ev.created_at >= now() - interval '7 days'),
    'shortlist_adds_30d', count(*) filter(where ev.name in ('shortlist_add','shortlist_added') and ev.created_at >= now() - interval '30 days'),
    'application_starts_24h', (select count(*) from applications where created_at >= now() - interval '24 hours'),
    'application_starts_7d', (select count(*) from applications where created_at >= now() - interval '7 days'),
    'doc_uploads_24h', (select count(*) from application_documents where created_at >= now() - interval '24 hours'),
    'doc_uploads_7d', (select count(*) from application_documents where created_at >= now() - interval '7 days'),
    'chat_sessions_24h', count(distinct ev.session_id) filter(where ev.name = 'page_view' and ev.created_at >= now() - interval '24 hours'),
    'chat_sessions_7d', count(distinct ev.session_id) filter(where ev.name = 'page_view' and ev.created_at >= now() - interval '7 days'),
    'returning_visitors_pct', 0,
    'avg_engaged_time_sec', coalesce((
      select avg((ev2.properties->>'engaged_seconds')::numeric)
      from events ev2
      where ev2.name = 'engaged_time_heartbeat' and ev2.created_at >= _cutover
        and ev2.traffic_class = 'real' and ev2.is_admin = false and ev2.is_test = false
    ), 0),
    'engaged_time_source', 'heartbeat',
    'daily_trend', coalesce((
      select jsonb_agg(row_to_json(t) order by t.day)
      from (
        select ev2.created_at::date as day,
               count(distinct ev2.visitor_id) as visitors,
               count(*) filter(where ev2.name = 'page_view') as pageviews
        from events ev2
        where ev2.created_at >= _cutover and ev2.traffic_class = 'real' and ev2.is_admin = false and ev2.is_test = false
        group by 1
      ) t
    ), '[]'::jsonb),
    'traffic_filter', 'known_real_only',
    'analytics_truth_started_at', _cutover,
    'truth_buckets', (
      select jsonb_build_object(
        'known_real', jsonb_build_object(
          'visitors', count(distinct ev3.visitor_id) filter(where ev3.created_at >= _cutover and ev3.traffic_class = 'real' and ev3.is_admin = false and ev3.is_test = false),
          'pageviews', count(*) filter(where ev3.created_at >= _cutover and ev3.traffic_class = 'real' and ev3.is_admin = false and ev3.is_test = false and ev3.name = 'page_view')
        ),
        'known_internal_or_test', jsonb_build_object(
          'visitors', count(distinct ev3.visitor_id) filter(where ev3.traffic_class in ('internal','synthetic','dev','seed','bot') or ev3.is_admin = true or ev3.is_test = true),
          'pageviews', count(*) filter(where (ev3.traffic_class in ('internal','synthetic','dev','seed','bot') or ev3.is_admin = true or ev3.is_test = true) and ev3.name = 'page_view')
        ),
        'unknown_legacy', jsonb_build_object(
          'visitors', count(distinct ev3.visitor_id) filter(where ev3.created_at < _cutover and ev3.traffic_class = 'real' and ev3.hostname is null),
          'pageviews', count(*) filter(where ev3.created_at < _cutover and ev3.traffic_class = 'real' and ev3.hostname is null and ev3.name = 'page_view')
        ),
        'all_traffic', jsonb_build_object(
          'visitors', count(distinct ev3.visitor_id),
          'pageviews', count(*) filter(where ev3.name = 'page_view')
        )
      )
      from events ev3 where ev3.created_at >= now() - interval '30 days'
    )
  ) INTO _overview
  FROM events ev
  WHERE ev.created_at >= _cutover AND ev.traffic_class = 'real' AND ev.is_admin = false AND ev.is_test = false;

  SELECT coalesce(jsonb_agg(row_to_json(f) order by f.step_order), '[]'::jsonb) INTO _funnel
  FROM (
    SELECT 'landing' as step, 1 as step_order, count(distinct ev.visitor_id) as visitors, 'visitor_id' as identity_domain
    FROM events ev WHERE ev.name = 'page_view' AND ev.route = '/' AND ev.created_at >= _cutover AND ev.traffic_class = 'real' AND ev.is_admin = false AND ev.is_test = false
    UNION ALL SELECT 'search', 2, count(distinct ev.visitor_id), 'visitor_id'
    FROM events ev WHERE (ev.name = 'search_performed' OR (ev.name = 'page_view' AND ev.route = '/search')) AND ev.created_at >= _cutover AND ev.traffic_class = 'real' AND ev.is_admin = false AND ev.is_test = false
    UNION ALL SELECT 'university_view', 3, count(distinct ev.visitor_id), 'visitor_id'
    FROM events ev WHERE ((ev.name = 'entity_view' AND ev.properties->>'entity_type' = 'university') OR (ev.name = 'page_view' AND ev.route like '/universities/%')) AND ev.created_at >= _cutover AND ev.traffic_class = 'real' AND ev.is_admin = false AND ev.is_test = false
    UNION ALL SELECT 'program_view', 4, count(distinct ev.visitor_id), 'visitor_id'
    FROM events ev WHERE ((ev.name = 'entity_view' AND ev.properties->>'entity_type' = 'program') OR (ev.name = 'page_view' AND ev.route like '/programs/%')) AND ev.created_at >= _cutover AND ev.traffic_class = 'real' AND ev.is_admin = false AND ev.is_test = false
    UNION ALL SELECT 'shortlist', 5, count(distinct ev.visitor_id), 'visitor_id'
    FROM events ev WHERE ev.name in ('shortlist_add','shortlist_added') AND ev.created_at >= _cutover AND ev.traffic_class = 'real' AND ev.is_admin = false AND ev.is_test = false
    UNION ALL SELECT 'register_start', 6, count(distinct ev.visitor_id), 'visitor_id'
    FROM events ev WHERE ev.name = 'register_start' AND ev.created_at >= _cutover AND ev.traffic_class = 'real' AND ev.is_admin = false AND ev.is_test = false
    UNION ALL SELECT 'register_complete', 7, (select count(*) from profiles where created_at >= _cutover), 'user_id'
    UNION ALL SELECT 'apply_click', 8, (select count(distinct user_id) from applications where created_at >= _cutover), 'user_id'
    UNION ALL SELECT 'doc_upload', 9, (select count(distinct a.user_id) from application_documents ad join applications a on a.id = ad.application_id where ad.created_at >= _cutover), 'user_id'
    UNION ALL SELECT 'payment', 10, 0, 'user_id'
  ) f;

  SELECT jsonb_build_object(
    'top_pages_by_views', coalesce((
      select jsonb_agg(row_to_json(t) order by t.views desc)
      from (
        select ev.route as page_route, count(*) as views, count(distinct ev.visitor_id) as unique_visitors
        from events ev where ev.name = 'page_view' and ev.route is not null
          and ev.created_at >= _cutover and ev.traffic_class = 'real' and ev.is_admin = false and ev.is_test = false
        group by 1 order by 2 desc limit 10
      ) t
    ), '[]'::jsonb),
    'top_exit_pages', '[]'::jsonb,
    'device_breakdown', '[]'::jsonb,
    'hourly_pattern', coalesce((
      select jsonb_agg(row_to_json(t) order by t.hr)
      from (
        select extract(hour from ev.created_at) as hr, count(distinct ev.visitor_id) as visitors
        from events ev where ev.name = 'page_view' and ev.created_at >= _cutover and ev.traffic_class = 'real' and ev.is_admin = false and ev.is_test = false
        group by 1
      ) t
    ), '[]'::jsonb),
    'bounce_rate', 0,
    'bounce_basis', 'not_calculated'
  ) INTO _engagement;

  SELECT jsonb_build_object(
    'top_by_views', coalesce((
      select jsonb_agg(row_to_json(t) order by t.views desc)
      from (
        with ev_views as (
          select ev.properties->>'entity_slug' as slug, ev.visitor_id from events ev
          where ev.name = 'entity_view' and ev.properties->>'entity_type' = 'university'
            and ev.created_at >= _cutover and ev.traffic_class = 'real' and ev.is_admin = false and ev.is_test = false
        ),
        rt_views as (
          select replace(ev.route, '/universities/', '') as slug, ev.visitor_id from events ev
          where ev.name = 'page_view' and ev.route like '/universities/%' and ev.route not like '/universities/%/%'
            and ev.created_at >= _cutover and ev.traffic_class = 'real' and ev.is_admin = false and ev.is_test = false
            and not exists (select 1 from ev_views evv where evv.slug = replace(ev.route, '/universities/', '') and evv.visitor_id = ev.visitor_id)
        ),
        combined as (select slug, visitor_id from ev_views union all select slug, visitor_id from rt_views)
        select coalesce(u.name_ar, c.slug) as name_ar, coalesce(u.name_en, c.slug) as name_en, c.slug,
          count(*) as views, count(distinct c.visitor_id) as unique_visitors
        from combined c left join universities u on u.slug = c.slug
        where c.slug is not null and c.slug != '' group by c.slug, u.name_ar, u.name_en order by views desc limit 10
      ) t
    ), '[]'::jsonb),
    'top_by_shortlist', coalesce((
      select jsonb_agg(row_to_json(t) order by t.adds desc)
      from (
        select coalesce(u.name_ar,'') as name_ar, coalesce(u.name_en,'') as name_en, coalesce(u.slug,'') as slug,
          ev.properties->>'entity_id' as entity_id, count(*) as adds, count(distinct ev.visitor_id) as unique_users
        from events ev left join universities u on u.id::text = ev.properties->>'entity_id'
        where ev.name in ('shortlist_add','shortlist_added') and ev.created_at >= _cutover and ev.traffic_class = 'real' and ev.is_admin = false and ev.is_test = false
        group by ev.properties->>'entity_id', u.name_ar, u.name_en, u.slug limit 10
      ) t
    ), '[]'::jsonb),
    'top_programs_by_views', coalesce((
      select jsonb_agg(row_to_json(t) order by t.views desc)
      from (
        with ev_views as (
          select ev.properties->>'entity_slug' as slug, ev.visitor_id from events ev
          where ev.name = 'entity_view' and ev.properties->>'entity_type' = 'program'
            and ev.created_at >= _cutover and ev.traffic_class = 'real' and ev.is_admin = false and ev.is_test = false
        ),
        rt_views as (
          select replace(ev.route, '/programs/', '') as slug, ev.visitor_id from events ev
          where ev.name = 'page_view' and ev.route like '/programs/%'
            and ev.created_at >= _cutover and ev.traffic_class = 'real' and ev.is_admin = false and ev.is_test = false
            and not exists (select 1 from ev_views evv where evv.slug = replace(ev.route, '/programs/', '') and evv.visitor_id = ev.visitor_id)
        ),
        combined as (select slug, visitor_id from ev_views union all select slug, visitor_id from rt_views)
        select coalesce(p.title, c.slug) as program_title, '' as university_name, c.slug as prog_slug,
          count(*) as views, count(distinct c.visitor_id) as unique_visitors
        from combined c left join programs p on p.program_slug = c.slug
        where c.slug is not null and c.slug != '' group by c.slug, p.title order by views desc limit 10
      ) t
    ), '[]'::jsonb),
    'data_source', 'blended_entity_and_route_per_slug'
  ) INTO _uni_intel;

  SELECT jsonb_build_object(
    'top_country_filters', coalesce((select jsonb_agg(row_to_json(t)) from (
      select ev.properties->>'country' as filter_val, count(*) as uses, count(distinct ev.visitor_id) as unique_users
      from events ev where ev.name = 'search_performed' and ev.properties->>'country' is not null
        and ev.created_at >= _cutover and ev.traffic_class = 'real' and ev.is_admin = false and ev.is_test = false
      group by 1 order by 2 desc limit 10) t), '[]'::jsonb),
    'top_degree_filters', coalesce((select jsonb_agg(row_to_json(t)) from (
      select ev.properties->>'degree' as filter_val, count(*) as uses
      from events ev where ev.name = 'search_performed' and ev.properties->>'degree' is not null
        and ev.created_at >= _cutover and ev.traffic_class = 'real' and ev.is_admin = false and ev.is_test = false
      group by 1 order by 2 desc limit 10) t), '[]'::jsonb),
    'search_to_click_pct', coalesce((
      select round(count(distinct ev.visitor_id) filter(where ev.name = 'search_result_click')::numeric /
        nullif(count(distinct ev.visitor_id) filter(where ev.name = 'search_performed'), 0) * 100, 1)
      from events ev where ev.name in ('search_performed','search_result_click')
        and ev.created_at >= _cutover and ev.traffic_class = 'real' and ev.is_admin = false and ev.is_test = false
    ), 0),
    'search_to_shortlist_pct', 0,
    'total_searches_30d', (select count(*) from events ev where ev.name = 'search_performed'
      and ev.created_at >= _cutover and ev.traffic_class = 'real' and ev.is_admin = false and ev.is_test = false),
    'attribution_method', 'visitor_id_unified'
  ) INTO _search_intel;

  SELECT jsonb_build_object(
    'universities_missing_tuition', coalesce((select jsonb_agg(row_to_json(t) order by t.views desc) from (
      select u.name_ar, u.slug, count(*) as views
      from events ev join universities u on u.slug = replace(ev.route, '/universities/', '')
      where ev.name = 'page_view' and ev.route like '/universities/%'
        and ev.created_at >= _cutover and ev.traffic_class = 'real' and ev.is_admin = false and ev.is_test = false
        and not exists (select 1 from programs p where p.university_id = u.id and p.tuition_usd_min is not null)
      group by u.name_ar, u.slug having count(*) >= 2 order by 3 desc limit 10) t), '[]'::jsonb),
    'programs_missing_deadlines', '[]'::jsonb,
    'high_traffic_incomplete', '[]'::jsonb
  ) INTO _content_gaps;

  result := jsonb_build_object(
    'overview', _overview, 'funnel', _funnel, 'engagement', _engagement,
    'university_intel', _uni_intel, 'search_intel', _search_intel,
    'content_gaps', _content_gaps, 'generated_at', now()
  );
  RETURN result;
END;
$$;
