
CREATE OR REPLACE FUNCTION public.decision_analytics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $BODY$
DECLARE
  result       jsonb;
  _overview    jsonb;
  _funnel      jsonb;
  _funnels     jsonb;
  _engagement  jsonb;
  _uni_intel   jsonb;
  _search_intel jsonb;
  _content_gaps jsonb;
  _cutover     timestamptz := '2026-03-17T16:00:00Z';
BEGIN

  -- Macro: real traffic filter conditions
  -- ev.created_at >= _cutover AND COALESCE(ev.traffic_class,'real')='real' AND COALESCE(ev.is_admin,false)=false AND COALESCE(ev.is_test,false)=false AND COALESCE(ev.is_staff,false)=false

  -- ============ OVERVIEW ============
  SELECT jsonb_build_object(
    'visitors_24h',   count(distinct ev.visitor_id) filter(where ev.created_at >= now() - interval '24 hours'),
    'visitors_7d',    count(distinct ev.visitor_id) filter(where ev.created_at >= now() - interval '7 days'),
    'visitors_30d',   count(distinct ev.visitor_id) filter(where ev.created_at >= now() - interval '30 days'),
    'active_now',     count(distinct ev.visitor_id) filter(where ev.created_at >= now() - interval '5 minutes'),
    'pageviews_24h',  count(*) filter(where ev.created_at >= now() - interval '24 hours'),
    'pageviews_7d',   count(*) filter(where ev.created_at >= now() - interval '7 days'),
    'pageviews_30d',  count(*) filter(where ev.created_at >= now() - interval '30 days'),
    'registrations_24h', count(distinct ev.visitor_id) filter(where ev.name = 'register_complete' AND ev.created_at >= now() - interval '24 hours'),
    'registrations_7d',  count(distinct ev.visitor_id) filter(where ev.name = 'register_complete' AND ev.created_at >= now() - interval '7 days'),
    'registrations_30d', count(distinct ev.visitor_id) filter(where ev.name = 'register_complete' AND ev.created_at >= now() - interval '30 days'),
    'shortlist_adds_24h', count(*) filter(where ev.name = 'shortlist_add' AND ev.created_at >= now() - interval '24 hours'),
    'shortlist_adds_7d',  count(*) filter(where ev.name = 'shortlist_add' AND ev.created_at >= now() - interval '7 days'),
    'shortlist_adds_30d', count(*) filter(where ev.name = 'shortlist_add' AND ev.created_at >= now() - interval '30 days'),
    'application_starts_24h', (SELECT count(*) FROM applications WHERE created_at >= now() - interval '24 hours'),
    'application_starts_7d',  (SELECT count(*) FROM applications WHERE created_at >= now() - interval '7 days'),
    'doc_uploads_24h', (SELECT count(*) FROM application_documents WHERE created_at >= now() - interval '24 hours'),
    'doc_uploads_7d',  (SELECT count(*) FROM application_documents WHERE created_at >= now() - interval '7 days'),
    'chat_sessions_24h', (SELECT count(*) FROM chat_sessions WHERE created_at >= now() - interval '24 hours'),
    'chat_sessions_7d',  (SELECT count(*) FROM chat_sessions WHERE created_at >= now() - interval '7 days'),
    'returning_visitors_pct', 0,
    'avg_engaged_time_sec', COALESCE(
      (SELECT avg((e2.properties->>'engaged_seconds')::int)
       FROM events e2
       WHERE e2.name = 'engaged_time_heartbeat'
         AND e2.created_at >= _cutover
         AND COALESCE(e2.traffic_class,'real')='real'
         AND COALESCE(e2.is_admin,false)=false
         AND COALESCE(e2.is_test,false)=false
         AND e2.created_at >= now() - interval '7 days'), 0),
    'engaged_time_source', 'heartbeat',
    'traffic_filter', 'known_real_only',
    'analytics_truth_started_at', _cutover,
    'daily_trend', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.day)
      FROM (
        SELECT e3.created_at::date as day,
               count(distinct e3.visitor_id) as visitors,
               count(*) as pageviews
        FROM events e3
        WHERE e3.created_at >= _cutover
          AND COALESCE(e3.traffic_class,'real')='real'
          AND COALESCE(e3.is_admin,false)=false
          AND COALESCE(e3.is_test,false)=false
          AND COALESCE(e3.is_staff,false)=false
          AND e3.created_at >= now() - interval '30 days'
        GROUP BY e3.created_at::date
      ) t
    ), '[]'::jsonb),
    'truth_buckets', jsonb_build_object(
      'known_real', jsonb_build_object(
        'visitors', (SELECT count(distinct visitor_id) FROM events WHERE created_at >= _cutover AND COALESCE(traffic_class,'real')='real' AND COALESCE(is_admin,false)=false AND COALESCE(is_test,false)=false AND COALESCE(is_staff,false)=false AND created_at >= now() - interval '30 days'),
        'pageviews', (SELECT count(*) FROM events WHERE created_at >= _cutover AND COALESCE(traffic_class,'real')='real' AND COALESCE(is_admin,false)=false AND COALESCE(is_test,false)=false AND COALESCE(is_staff,false)=false AND created_at >= now() - interval '30 days')
      ),
      'unknown_legacy', jsonb_build_object(
        'visitors', (SELECT count(distinct visitor_id) FROM events WHERE created_at < _cutover AND created_at >= now() - interval '30 days'),
        'pageviews', (SELECT count(*) FROM events WHERE created_at < _cutover AND created_at >= now() - interval '30 days')
      ),
      'known_internal_or_test', jsonb_build_object(
        'visitors', (SELECT count(distinct visitor_id) FROM events WHERE (COALESCE(is_admin,false)=true OR COALESCE(is_test,false)=true OR COALESCE(is_staff,false)=true OR traffic_class IN ('internal','dev','seed','synthetic','bot')) AND created_at >= now() - interval '30 days'),
        'pageviews', (SELECT count(*) FROM events WHERE (COALESCE(is_admin,false)=true OR COALESCE(is_test,false)=true OR COALESCE(is_staff,false)=true OR traffic_class IN ('internal','dev','seed','synthetic','bot')) AND created_at >= now() - interval '30 days')
      ),
      'all_traffic', jsonb_build_object(
        'visitors', (SELECT count(distinct visitor_id) FROM events WHERE created_at >= now() - interval '30 days'),
        'pageviews', (SELECT count(*) FROM events WHERE created_at >= now() - interval '30 days')
      )
    )
  ) INTO _overview
  FROM events ev
  WHERE ev.created_at >= _cutover
    AND COALESCE(ev.traffic_class, 'real') = 'real'
    AND COALESCE(ev.is_admin, false) = false
    AND COALESCE(ev.is_test, false) = false
    AND COALESCE(ev.is_staff, false) = false;

  -- ============ SINGLE FUNNEL (backward compat) ============
  SELECT jsonb_build_array(
    jsonb_build_object('step','landing','step_order',1,'identity_domain','visitor_id','visitors',
      (SELECT count(distinct visitor_id) FROM events WHERE created_at >= _cutover AND COALESCE(traffic_class,'real')='real' AND COALESCE(is_admin,false)=false AND COALESCE(is_test,false)=false AND COALESCE(is_staff,false)=false AND created_at >= now()-interval '30 days' AND name IN ('page_view','landing') AND route = '/')),
    jsonb_build_object('step','search','step_order',2,'identity_domain','visitor_id','visitors',
      (SELECT count(distinct visitor_id) FROM events WHERE created_at >= _cutover AND COALESCE(traffic_class,'real')='real' AND COALESCE(is_admin,false)=false AND COALESCE(is_test,false)=false AND COALESCE(is_staff,false)=false AND created_at >= now()-interval '30 days' AND (name = 'search_performed' OR route LIKE '/search%'))),
    jsonb_build_object('step','university_view','step_order',3,'identity_domain','visitor_id','visitors',
      (SELECT count(distinct visitor_id) FROM events WHERE created_at >= _cutover AND COALESCE(traffic_class,'real')='real' AND COALESCE(is_admin,false)=false AND COALESCE(is_test,false)=false AND COALESCE(is_staff,false)=false AND created_at >= now()-interval '30 days' AND name = 'entity_view' AND properties->>'entity_type' = 'university')),
    jsonb_build_object('step','program_view','step_order',4,'identity_domain','visitor_id','visitors',
      (SELECT count(distinct visitor_id) FROM events WHERE created_at >= _cutover AND COALESCE(traffic_class,'real')='real' AND COALESCE(is_admin,false)=false AND COALESCE(is_test,false)=false AND COALESCE(is_staff,false)=false AND created_at >= now()-interval '30 days' AND name = 'entity_view' AND properties->>'entity_type' = 'program')),
    jsonb_build_object('step','shortlist','step_order',5,'identity_domain','visitor_id','visitors',
      (SELECT count(distinct visitor_id) FROM events WHERE created_at >= _cutover AND COALESCE(traffic_class,'real')='real' AND COALESCE(is_admin,false)=false AND COALESCE(is_test,false)=false AND COALESCE(is_staff,false)=false AND created_at >= now()-interval '30 days' AND name = 'shortlist_add')),
    jsonb_build_object('step','register_start','step_order',6,'identity_domain','visitor_id','visitors',
      (SELECT count(distinct visitor_id) FROM events WHERE created_at >= _cutover AND COALESCE(traffic_class,'real')='real' AND COALESCE(is_admin,false)=false AND COALESCE(is_test,false)=false AND COALESCE(is_staff,false)=false AND created_at >= now()-interval '30 days' AND name = 'register_start')),
    jsonb_build_object('step','register_complete','step_order',7,'identity_domain','user_id','visitors',
      (SELECT count(*) FROM profiles WHERE created_at >= now()-interval '30 days')),
    jsonb_build_object('step','apply_click','step_order',8,'identity_domain','user_id','visitors',
      (SELECT count(*) FROM applications WHERE created_at >= now()-interval '30 days')),
    jsonb_build_object('step','doc_upload','step_order',9,'identity_domain','user_id','visitors',
      (SELECT count(distinct application_id) FROM application_documents WHERE created_at >= now()-interval '30 days')),
    jsonb_build_object('step','payment','step_order',10,'identity_domain','user_id','visitors',
      (SELECT count(distinct visitor_id) FROM events WHERE created_at >= _cutover AND COALESCE(traffic_class,'real')='real' AND COALESCE(is_admin,false)=false AND COALESCE(is_test,false)=false AND name = 'payment_complete' AND created_at >= now()-interval '30 days'))
  ) INTO _funnel;

  -- ============ 3 FUNNELS (Phase 5) ============
  SELECT jsonb_build_array(
    jsonb_build_object('name','discovery','steps', jsonb_build_array(
      jsonb_build_object('step','landing','step_order',1,'identity_domain','visitor_id','visitors',
        (SELECT count(distinct visitor_id) FROM events WHERE created_at >= _cutover AND COALESCE(traffic_class,'real')='real' AND COALESCE(is_admin,false)=false AND COALESCE(is_test,false)=false AND COALESCE(is_staff,false)=false AND created_at >= now()-interval '30 days' AND name IN ('page_view','landing') AND route = '/')),
      jsonb_build_object('step','search_page','step_order',2,'identity_domain','visitor_id','visitors',
        (SELECT count(distinct visitor_id) FROM events WHERE created_at >= _cutover AND COALESCE(traffic_class,'real')='real' AND COALESCE(is_admin,false)=false AND COALESCE(is_test,false)=false AND COALESCE(is_staff,false)=false AND created_at >= now()-interval '30 days' AND route LIKE '/search%')),
      jsonb_build_object('step','search_performed','step_order',3,'identity_domain','visitor_id','visitors',
        (SELECT count(distinct visitor_id) FROM events WHERE created_at >= _cutover AND COALESCE(traffic_class,'real')='real' AND COALESCE(is_admin,false)=false AND COALESCE(is_test,false)=false AND COALESCE(is_staff,false)=false AND created_at >= now()-interval '30 days' AND name = 'search_performed')),
      jsonb_build_object('step','university_view','step_order',4,'identity_domain','visitor_id','visitors',
        (SELECT count(distinct visitor_id) FROM events WHERE created_at >= _cutover AND COALESCE(traffic_class,'real')='real' AND COALESCE(is_admin,false)=false AND COALESCE(is_test,false)=false AND COALESCE(is_staff,false)=false AND created_at >= now()-interval '30 days' AND name = 'entity_view' AND properties->>'entity_type' = 'university')),
      jsonb_build_object('step','program_view','step_order',5,'identity_domain','visitor_id','visitors',
        (SELECT count(distinct visitor_id) FROM events WHERE created_at >= _cutover AND COALESCE(traffic_class,'real')='real' AND COALESCE(is_admin,false)=false AND COALESCE(is_test,false)=false AND COALESCE(is_staff,false)=false AND created_at >= now()-interval '30 days' AND name = 'entity_view' AND properties->>'entity_type' = 'program')),
      jsonb_build_object('step','shortlist','step_order',6,'identity_domain','visitor_id','visitors',
        (SELECT count(distinct visitor_id) FROM events WHERE created_at >= _cutover AND COALESCE(traffic_class,'real')='real' AND COALESCE(is_admin,false)=false AND COALESCE(is_test,false)=false AND COALESCE(is_staff,false)=false AND created_at >= now()-interval '30 days' AND name = 'shortlist_add'))
    )),
    jsonb_build_object('name','account','steps', jsonb_build_array(
      jsonb_build_object('step','register_start','step_order',1,'identity_domain','visitor_id','visitors',
        (SELECT count(distinct visitor_id) FROM events WHERE created_at >= _cutover AND COALESCE(traffic_class,'real')='real' AND COALESCE(is_admin,false)=false AND COALESCE(is_test,false)=false AND COALESCE(is_staff,false)=false AND created_at >= now()-interval '30 days' AND name = 'register_start')),
      jsonb_build_object('step','register_complete','step_order',2,'identity_domain','user_id','visitors',
        (SELECT count(*) FROM profiles WHERE created_at >= now()-interval '30 days')),
      jsonb_build_object('step','account_open','step_order',3,'identity_domain','user_id','visitors',
        (SELECT count(distinct visitor_id) FROM events WHERE created_at >= _cutover AND COALESCE(traffic_class,'real')='real' AND COALESCE(is_admin,false)=false AND COALESCE(is_test,false)=false AND created_at >= now()-interval '30 days' AND name = 'account_open')),
      jsonb_build_object('step','service_step_open','step_order',4,'identity_domain','user_id','visitors',
        (SELECT count(distinct visitor_id) FROM events WHERE created_at >= _cutover AND COALESCE(traffic_class,'real')='real' AND COALESCE(is_admin,false)=false AND COALESCE(is_test,false)=false AND created_at >= now()-interval '30 days' AND name = 'service_step_open'))
    )),
    jsonb_build_object('name','revenue','steps', jsonb_build_array(
      jsonb_build_object('step','application_start','step_order',1,'identity_domain','user_id','visitors',
        (SELECT count(*) FROM applications WHERE created_at >= now()-interval '30 days')),
      jsonb_build_object('step','doc_upload','step_order',2,'identity_domain','user_id','visitors',
        (SELECT count(distinct application_id) FROM application_documents WHERE created_at >= now()-interval '30 days')),
      jsonb_build_object('step','application_submitted','step_order',3,'identity_domain','user_id','visitors',
        (SELECT count(distinct visitor_id) FROM events WHERE created_at >= _cutover AND COALESCE(traffic_class,'real')='real' AND COALESCE(is_admin,false)=false AND COALESCE(is_test,false)=false AND created_at >= now()-interval '30 days' AND name = 'application_submitted')),
      jsonb_build_object('step','payment_start','step_order',4,'identity_domain','user_id','visitors',
        (SELECT count(distinct visitor_id) FROM events WHERE created_at >= _cutover AND COALESCE(traffic_class,'real')='real' AND COALESCE(is_admin,false)=false AND COALESCE(is_test,false)=false AND created_at >= now()-interval '30 days' AND name = 'payment_start')),
      jsonb_build_object('step','payment_complete','step_order',5,'identity_domain','user_id','visitors',
        (SELECT count(distinct visitor_id) FROM events WHERE created_at >= _cutover AND COALESCE(traffic_class,'real')='real' AND COALESCE(is_admin,false)=false AND COALESCE(is_test,false)=false AND created_at >= now()-interval '30 days' AND name = 'payment_complete')),
      jsonb_build_object('step','payment_failed','step_order',6,'identity_domain','user_id','visitors',
        (SELECT count(distinct visitor_id) FROM events WHERE created_at >= _cutover AND COALESCE(traffic_class,'real')='real' AND COALESCE(is_admin,false)=false AND COALESCE(is_test,false)=false AND created_at >= now()-interval '30 days' AND name = 'payment_failed'))
    ))
  ) INTO _funnels;

  -- ============ ENGAGEMENT ============
  SELECT jsonb_build_object(
    'bounce_rate', 0,
    'bounce_basis', 'not_calculated',
    'hourly_pattern', COALESCE((
      SELECT jsonb_agg(row_to_json(h) ORDER BY h.hr)
      FROM (
        SELECT extract(hour from e4.created_at)::int as hr,
               count(distinct e4.visitor_id) as visitors
        FROM events e4
        WHERE e4.created_at >= _cutover
          AND COALESCE(e4.traffic_class,'real')='real'
          AND COALESCE(e4.is_admin,false)=false
          AND COALESCE(e4.is_test,false)=false
          AND COALESCE(e4.is_staff,false)=false
          AND e4.created_at >= now() - interval '24 hours'
        GROUP BY 1
      ) h
    ), '[]'::jsonb),
    'device_breakdown', '[]'::jsonb,
    'top_pages_by_views', COALESCE((
      SELECT jsonb_agg(row_to_json(pg) ORDER BY pg.views DESC)
      FROM (
        SELECT e5.route as page_route, count(*) as views, count(distinct e5.visitor_id) as unique_visitors
        FROM events e5
        WHERE e5.created_at >= _cutover
          AND COALESCE(e5.traffic_class,'real')='real'
          AND COALESCE(e5.is_admin,false)=false
          AND COALESCE(e5.is_test,false)=false
          AND COALESCE(e5.is_staff,false)=false
          AND e5.created_at >= now() - interval '7 days'
          AND e5.route IS NOT NULL
        GROUP BY e5.route ORDER BY views DESC LIMIT 10
      ) pg
    ), '[]'::jsonb),
    'top_exit_pages', '[]'::jsonb
  ) INTO _engagement;

  -- ============ UNIVERSITY INTELLIGENCE ============
  SELECT jsonb_build_object(
    'data_source', 'blended_entity_and_route_per_slug',
    'top_by_views', COALESCE((
      SELECT jsonb_agg(row_to_json(u) ORDER BY u.views DESC)
      FROM (
        SELECT
          COALESCE(uni.name_ar, e6.properties->>'entity_slug') as name_ar,
          e6.properties->>'entity_slug' as slug,
          count(*) as views,
          count(distinct e6.visitor_id) as unique_visitors
        FROM events e6
        LEFT JOIN universities uni ON uni.id::text = e6.properties->>'entity_id'
        WHERE e6.created_at >= _cutover
          AND COALESCE(e6.traffic_class,'real')='real'
          AND COALESCE(e6.is_admin,false)=false
          AND COALESCE(e6.is_test,false)=false
          AND COALESCE(e6.is_staff,false)=false
          AND e6.created_at >= now() - interval '30 days'
          AND e6.name = 'entity_view' AND e6.properties->>'entity_type' = 'university'
        GROUP BY name_ar, slug
        ORDER BY views DESC LIMIT 10
      ) u
    ), '[]'::jsonb),
    'top_by_shortlist', COALESCE((
      SELECT jsonb_agg(row_to_json(u) ORDER BY u.adds DESC)
      FROM (
        SELECT
          COALESCE(uni.name_ar, e7.properties->>'entity_slug') as name_ar,
          e7.properties->>'entity_id' as entity_id,
          count(*) as adds,
          count(distinct e7.visitor_id) as unique_users
        FROM events e7
        LEFT JOIN universities uni ON uni.id::text = e7.properties->>'entity_id'
        WHERE e7.created_at >= _cutover
          AND COALESCE(e7.traffic_class,'real')='real'
          AND COALESCE(e7.is_admin,false)=false
          AND COALESCE(e7.is_test,false)=false
          AND COALESCE(e7.is_staff,false)=false
          AND e7.created_at >= now() - interval '30 days'
          AND e7.name = 'shortlist_add'
        GROUP BY name_ar, entity_id
        ORDER BY adds DESC LIMIT 10
      ) u
    ), '[]'::jsonb),
    'top_programs_by_views', COALESCE((
      SELECT jsonb_agg(row_to_json(p2) ORDER BY p2.views DESC)
      FROM (
        SELECT
          COALESCE(prog.title_ar, e8.properties->>'entity_slug') as program_title,
          COALESCE(uni.name_ar, '') as university_name,
          e8.properties->>'entity_slug' as prog_slug,
          count(*) as views,
          count(distinct e8.visitor_id) as unique_visitors
        FROM events e8
        LEFT JOIN programs prog ON prog.id::text = e8.properties->>'entity_id'
        LEFT JOIN universities uni ON uni.id = prog.university_id
        WHERE e8.created_at >= _cutover
          AND COALESCE(e8.traffic_class,'real')='real'
          AND COALESCE(e8.is_admin,false)=false
          AND COALESCE(e8.is_test,false)=false
          AND COALESCE(e8.is_staff,false)=false
          AND e8.created_at >= now() - interval '30 days'
          AND e8.name = 'entity_view' AND e8.properties->>'entity_type' = 'program'
        GROUP BY program_title, university_name, prog_slug
        ORDER BY views DESC LIMIT 10
      ) p2
    ), '[]'::jsonb)
  ) INTO _uni_intel;

  -- ============ SEARCH INTELLIGENCE ============
  SELECT jsonb_build_object(
    'total_searches_30d', (SELECT count(*) FROM events WHERE name='search_performed' AND created_at >= _cutover AND COALESCE(traffic_class,'real')='real' AND COALESCE(is_admin,false)=false AND COALESCE(is_test,false)=false AND created_at >= now()-interval '30 days'),
    'search_to_click_pct', 0,
    'search_to_shortlist_pct', 0,
    'attribution_method', 'visitor_id_unified',
    'top_country_filters', COALESCE((
      SELECT jsonb_agg(row_to_json(f) ORDER BY f.uses DESC)
      FROM (
        SELECT e9.properties->'filters'->>'country' as filter_val,
               count(*) as uses,
               count(distinct e9.visitor_id) as unique_users
        FROM events e9
        WHERE e9.name = 'search_performed'
          AND e9.created_at >= _cutover
          AND COALESCE(e9.traffic_class,'real')='real'
          AND COALESCE(e9.is_admin,false)=false
          AND COALESCE(e9.is_test,false)=false
          AND e9.created_at >= now()-interval '30 days'
          AND e9.properties->'filters'->>'country' IS NOT NULL
        GROUP BY filter_val ORDER BY uses DESC LIMIT 10
      ) f
    ), '[]'::jsonb),
    'top_degree_filters', COALESCE((
      SELECT jsonb_agg(row_to_json(f) ORDER BY f.uses DESC)
      FROM (
        SELECT e10.properties->'filters'->>'degree' as filter_val,
               count(*) as uses
        FROM events e10
        WHERE e10.name = 'search_performed'
          AND e10.created_at >= _cutover
          AND COALESCE(e10.traffic_class,'real')='real'
          AND COALESCE(e10.is_admin,false)=false
          AND COALESCE(e10.is_test,false)=false
          AND e10.created_at >= now()-interval '30 days'
          AND e10.properties->'filters'->>'degree' IS NOT NULL
        GROUP BY filter_val ORDER BY uses DESC LIMIT 10
      ) f
    ), '[]'::jsonb)
  ) INTO _search_intel;

  -- ============ CONTENT GAPS ============
  SELECT jsonb_build_object(
    'universities_missing_tuition', COALESCE((
      SELECT jsonb_agg(row_to_json(u))
      FROM (
        SELECT uni.name_ar, uni.id::text as slug, 0 as views
        FROM universities uni
        WHERE NOT EXISTS (
          SELECT 1 FROM programs prog
          WHERE prog.university_id = uni.id AND prog.tuition_usd_min IS NOT NULL
        )
        LIMIT 10
      ) u
    ), '[]'::jsonb),
    'programs_missing_deadlines', COALESCE((
      SELECT jsonb_agg(row_to_json(p2))
      FROM (
        SELECT prog.title_ar as title, uni.name_ar as uni_name, uni.id::text as uni_slug, 0 as views
        FROM programs prog
        JOIN universities uni ON uni.id = prog.university_id
        WHERE prog.application_deadline IS NULL
        LIMIT 10
      ) p2
    ), '[]'::jsonb),
    'high_traffic_incomplete', '[]'::jsonb
  ) INTO _content_gaps;

  -- ============ COMBINE ============
  result := jsonb_build_object(
    'overview', _overview,
    'funnel', _funnel,
    'funnels', _funnels,
    'engagement', _engagement,
    'university_intel', _uni_intel,
    'search_intel', _search_intel,
    'content_gaps', _content_gaps,
    'generated_at', now()
  );

  RETURN result;
END;
$BODY$;
