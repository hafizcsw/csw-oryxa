
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

  -- ============ REAL TRAFFIC FILTER (reused) ============
  -- known_real: after cutover + traffic_class='real' + not admin/test
  -- We define a CTE-like approach inline

  -- ============ OVERVIEW ============
  WITH real_ev AS (
    SELECT * FROM events ev
    WHERE ev.created_at >= _cutover
      AND COALESCE(ev.traffic_class, 'real') = 'real'
      AND COALESCE(ev.is_admin, false) = false
      AND COALESCE(ev.is_test, false) = false
      AND COALESCE(ev.is_staff, false) = false
  )
  SELECT jsonb_build_object(
    'visitors_24h',   count(distinct visitor_id) filter(where created_at >= now() - interval '24 hours'),
    'visitors_7d',    count(distinct visitor_id) filter(where created_at >= now() - interval '7 days'),
    'visitors_30d',   count(distinct visitor_id) filter(where created_at >= now() - interval '30 days'),
    'active_now',     count(distinct visitor_id) filter(where created_at >= now() - interval '5 minutes'),
    'pageviews_24h',  count(*) filter(where created_at >= now() - interval '24 hours'),
    'pageviews_7d',   count(*) filter(where created_at >= now() - interval '7 days'),
    'pageviews_30d',  count(*) filter(where created_at >= now() - interval '30 days'),
    'registrations_24h', count(distinct visitor_id) filter(where ev.name = 'register_complete' AND created_at >= now() - interval '24 hours'),
    'registrations_7d',  count(distinct visitor_id) filter(where ev.name = 'register_complete' AND created_at >= now() - interval '7 days'),
    'registrations_30d', count(distinct visitor_id) filter(where ev.name = 'register_complete' AND created_at >= now() - interval '30 days'),
    'shortlist_adds_24h', count(*) filter(where ev.name = 'shortlist_add' AND created_at >= now() - interval '24 hours'),
    'shortlist_adds_7d',  count(*) filter(where ev.name = 'shortlist_add' AND created_at >= now() - interval '7 days'),
    'shortlist_adds_30d', count(*) filter(where ev.name = 'shortlist_add' AND created_at >= now() - interval '30 days'),
    'application_starts_24h', (SELECT count(*) FROM applications WHERE created_at >= now() - interval '24 hours'),
    'application_starts_7d',  (SELECT count(*) FROM applications WHERE created_at >= now() - interval '7 days'),
    'doc_uploads_24h', (SELECT count(*) FROM application_documents WHERE created_at >= now() - interval '24 hours'),
    'doc_uploads_7d',  (SELECT count(*) FROM application_documents WHERE created_at >= now() - interval '7 days'),
    'chat_sessions_24h', (SELECT count(*) FROM chat_sessions WHERE created_at >= now() - interval '24 hours'),
    'chat_sessions_7d',  (SELECT count(*) FROM chat_sessions WHERE created_at >= now() - interval '7 days'),
    'returning_visitors_pct', 0,
    'avg_engaged_time_sec', COALESCE(
      (SELECT avg((ev2.properties->>'engaged_seconds')::int)
       FROM real_ev ev2
       WHERE ev2.name = 'engaged_time_heartbeat'
         AND ev2.created_at >= now() - interval '7 days'), 0),
    'engaged_time_source', 'heartbeat',
    'traffic_filter', 'known_real_only',
    'analytics_truth_started_at', _cutover,
    'daily_trend', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.day)
      FROM (
        SELECT created_at::date as day,
               count(distinct visitor_id) as visitors,
               count(*) as pageviews
        FROM real_ev
        WHERE created_at >= now() - interval '30 days'
        GROUP BY created_at::date
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
  FROM real_ev ev;

  -- ============ SINGLE FUNNEL (backward compat) ============
  WITH real_ev AS (
    SELECT * FROM events ev
    WHERE ev.created_at >= _cutover
      AND COALESCE(ev.traffic_class, 'real') = 'real'
      AND COALESCE(ev.is_admin, false) = false
      AND COALESCE(ev.is_test, false) = false
      AND COALESCE(ev.is_staff, false) = false
      AND ev.created_at >= now() - interval '30 days'
  )
  SELECT COALESCE(jsonb_agg(row_to_json(s) ORDER BY s.step_order), '[]'::jsonb)
  INTO _funnel
  FROM (
    VALUES
      ('landing',         1, (SELECT count(distinct visitor_id) FROM real_ev WHERE ev.name IN ('page_view','landing') AND route = '/'), 'visitor_id'),
      ('search',          2, (SELECT count(distinct visitor_id) FROM real_ev WHERE ev.name IN ('search_performed','page_view') AND route LIKE '/search%'), 'visitor_id'),
      ('university_view', 3, (SELECT count(distinct visitor_id) FROM real_ev WHERE ev.name = 'entity_view' AND (ev.properties->>'entity_type') = 'university'), 'visitor_id'),
      ('program_view',    4, (SELECT count(distinct visitor_id) FROM real_ev WHERE ev.name = 'entity_view' AND (ev.properties->>'entity_type') = 'program'), 'visitor_id'),
      ('shortlist',       5, (SELECT count(distinct visitor_id) FROM real_ev WHERE ev.name = 'shortlist_add'), 'visitor_id'),
      ('register_start',  6, (SELECT count(distinct visitor_id) FROM real_ev WHERE ev.name = 'register_start'), 'visitor_id'),
      ('register_complete', 7, (SELECT count(*) FROM profiles WHERE created_at >= now() - interval '30 days'), 'user_id'),
      ('apply_click',     8, (SELECT count(*) FROM applications WHERE created_at >= now() - interval '30 days'), 'user_id'),
      ('doc_upload',      9, (SELECT count(distinct application_id) FROM application_documents WHERE created_at >= now() - interval '30 days'), 'user_id'),
      ('payment',        10, (SELECT count(distinct visitor_id) FROM real_ev WHERE ev.name = 'payment_complete'), 'user_id')
  ) AS s(step, step_order, visitors, identity_domain);

  -- ============ 3 FUNNELS (Phase 5) ============
  WITH real_ev AS (
    SELECT * FROM events ev
    WHERE ev.created_at >= _cutover
      AND COALESCE(ev.traffic_class, 'real') = 'real'
      AND COALESCE(ev.is_admin, false) = false
      AND COALESCE(ev.is_test, false) = false
      AND COALESCE(ev.is_staff, false) = false
      AND ev.created_at >= now() - interval '30 days'
  )
  SELECT jsonb_build_array(
    jsonb_build_object(
      'name', 'discovery',
      'steps', COALESCE((
        SELECT jsonb_agg(row_to_json(s) ORDER BY s.step_order)
        FROM (
          VALUES
            ('landing',         1, (SELECT count(distinct visitor_id) FROM real_ev WHERE ev.name IN ('page_view','landing') AND route = '/'), 'visitor_id'),
            ('search_page',     2, (SELECT count(distinct visitor_id) FROM real_ev WHERE route LIKE '/search%'), 'visitor_id'),
            ('search_performed',3, (SELECT count(distinct visitor_id) FROM real_ev WHERE ev.name = 'search_performed'), 'visitor_id'),
            ('university_view', 4, (SELECT count(distinct visitor_id) FROM real_ev WHERE ev.name = 'entity_view' AND (ev.properties->>'entity_type') = 'university'), 'visitor_id'),
            ('program_view',    5, (SELECT count(distinct visitor_id) FROM real_ev WHERE ev.name = 'entity_view' AND (ev.properties->>'entity_type') = 'program'), 'visitor_id'),
            ('shortlist',       6, (SELECT count(distinct visitor_id) FROM real_ev WHERE ev.name = 'shortlist_add'), 'visitor_id')
        ) AS s(step, step_order, visitors, identity_domain)
      ), '[]'::jsonb)
    ),
    jsonb_build_object(
      'name', 'account',
      'steps', COALESCE((
        SELECT jsonb_agg(row_to_json(s) ORDER BY s.step_order)
        FROM (
          VALUES
            ('register_start',    1, (SELECT count(distinct visitor_id) FROM real_ev WHERE ev.name = 'register_start'), 'visitor_id'),
            ('register_complete', 2, (SELECT count(*) FROM profiles WHERE created_at >= now() - interval '30 days'), 'user_id'),
            ('account_open',      3, (SELECT count(distinct visitor_id) FROM real_ev WHERE ev.name = 'account_open'), 'user_id'),
            ('service_step_open', 4, (SELECT count(distinct visitor_id) FROM real_ev WHERE ev.name = 'service_step_open'), 'user_id')
        ) AS s(step, step_order, visitors, identity_domain)
      ), '[]'::jsonb)
    ),
    jsonb_build_object(
      'name', 'revenue',
      'steps', COALESCE((
        SELECT jsonb_agg(row_to_json(s) ORDER BY s.step_order)
        FROM (
          VALUES
            ('application_start',    1, (SELECT count(*) FROM applications WHERE created_at >= now() - interval '30 days'), 'user_id'),
            ('doc_upload',           2, (SELECT count(distinct application_id) FROM application_documents WHERE created_at >= now() - interval '30 days'), 'user_id'),
            ('application_submitted',3, (SELECT count(distinct visitor_id) FROM real_ev WHERE ev.name = 'application_submitted'), 'user_id'),
            ('payment_start',        4, (SELECT count(distinct visitor_id) FROM real_ev WHERE ev.name = 'payment_start'), 'user_id'),
            ('payment_complete',     5, (SELECT count(distinct visitor_id) FROM real_ev WHERE ev.name = 'payment_complete'), 'user_id'),
            ('payment_failed',       6, (SELECT count(distinct visitor_id) FROM real_ev WHERE ev.name = 'payment_failed'), 'user_id')
        ) AS s(step, step_order, visitors, identity_domain)
      ), '[]'::jsonb)
    )
  ) INTO _funnels;

  -- ============ ENGAGEMENT ============
  WITH real_ev AS (
    SELECT * FROM events ev
    WHERE ev.created_at >= _cutover
      AND COALESCE(ev.traffic_class, 'real') = 'real'
      AND COALESCE(ev.is_admin, false) = false
      AND COALESCE(ev.is_test, false) = false
      AND COALESCE(ev.is_staff, false) = false
  )
  SELECT jsonb_build_object(
    'bounce_rate', 0,
    'bounce_basis', 'not_calculated',
    'hourly_pattern', COALESCE((
      SELECT jsonb_agg(row_to_json(h) ORDER BY h.hr)
      FROM (
        SELECT extract(hour from created_at)::int as hr,
               count(distinct visitor_id) as visitors
        FROM real_ev WHERE created_at >= now() - interval '24 hours'
        GROUP BY 1
      ) h
    ), '[]'::jsonb),
    'device_breakdown', '[]'::jsonb,
    'top_pages_by_views', COALESCE((
      SELECT jsonb_agg(row_to_json(p) ORDER BY p.views DESC)
      FROM (
        SELECT route as page_route, count(*) as views, count(distinct visitor_id) as unique_visitors
        FROM real_ev WHERE created_at >= now() - interval '7 days' AND route IS NOT NULL
        GROUP BY route ORDER BY views DESC LIMIT 10
      ) p
    ), '[]'::jsonb),
    'top_exit_pages', '[]'::jsonb
  ) INTO _engagement;

  -- ============ UNIVERSITY INTELLIGENCE ============
  WITH real_ev AS (
    SELECT * FROM events ev
    WHERE ev.created_at >= _cutover
      AND COALESCE(ev.traffic_class, 'real') = 'real'
      AND COALESCE(ev.is_admin, false) = false
      AND COALESCE(ev.is_test, false) = false
      AND COALESCE(ev.is_staff, false) = false
      AND ev.created_at >= now() - interval '30 days'
  )
  SELECT jsonb_build_object(
    'data_source', 'blended_entity_and_route_per_slug',
    'top_by_views', COALESCE((
      SELECT jsonb_agg(row_to_json(u) ORDER BY u.views DESC)
      FROM (
        SELECT
          COALESCE(uni.name_ar, ev.properties->>'entity_slug') as name_ar,
          ev.properties->>'entity_slug' as slug,
          count(*) as views,
          count(distinct ev.visitor_id) as unique_visitors
        FROM real_ev ev
        LEFT JOIN universities uni ON uni.id = ev.properties->>'entity_id'
        WHERE ev.name = 'entity_view' AND ev.properties->>'entity_type' = 'university'
        GROUP BY name_ar, slug
        ORDER BY views DESC LIMIT 10
      ) u
    ), '[]'::jsonb),
    'top_by_shortlist', COALESCE((
      SELECT jsonb_agg(row_to_json(u) ORDER BY u.adds DESC)
      FROM (
        SELECT
          COALESCE(uni.name_ar, ev.properties->>'entity_slug') as name_ar,
          ev.properties->>'entity_id' as entity_id,
          count(*) as adds,
          count(distinct ev.visitor_id) as unique_users
        FROM real_ev ev
        LEFT JOIN universities uni ON uni.id = ev.properties->>'entity_id'
        WHERE ev.name = 'shortlist_add'
        GROUP BY name_ar, entity_id
        ORDER BY adds DESC LIMIT 10
      ) u
    ), '[]'::jsonb),
    'top_programs_by_views', COALESCE((
      SELECT jsonb_agg(row_to_json(p2) ORDER BY p2.views DESC)
      FROM (
        SELECT
          COALESCE(p.title_ar, ev.properties->>'entity_slug') as program_title,
          COALESCE(uni.name_ar, '') as university_name,
          ev.properties->>'entity_slug' as prog_slug,
          count(*) as views,
          count(distinct ev.visitor_id) as unique_visitors
        FROM real_ev ev
        LEFT JOIN programs p ON p.id = ev.properties->>'entity_id'
        LEFT JOIN universities uni ON uni.id = p.university_id
        WHERE ev.name = 'entity_view' AND ev.properties->>'entity_type' = 'program'
        GROUP BY program_title, university_name, prog_slug
        ORDER BY views DESC LIMIT 10
      ) p2
    ), '[]'::jsonb)
  ) INTO _uni_intel;

  -- ============ SEARCH INTELLIGENCE ============
  WITH real_ev AS (
    SELECT * FROM events ev
    WHERE ev.created_at >= _cutover
      AND COALESCE(ev.traffic_class, 'real') = 'real'
      AND COALESCE(ev.is_admin, false) = false
      AND COALESCE(ev.is_test, false) = false
      AND COALESCE(ev.is_staff, false) = false
      AND ev.created_at >= now() - interval '30 days'
  )
  SELECT jsonb_build_object(
    'total_searches_30d', (SELECT count(*) FROM real_ev WHERE ev.name = 'search_performed'),
    'search_to_click_pct', 0,
    'search_to_shortlist_pct', 0,
    'attribution_method', 'visitor_id_unified',
    'top_country_filters', COALESCE((
      SELECT jsonb_agg(row_to_json(f) ORDER BY f.uses DESC)
      FROM (
        SELECT ev.properties->'filters'->>'country' as filter_val,
               count(*) as uses,
               count(distinct ev.visitor_id) as unique_users
        FROM real_ev ev
        WHERE ev.name = 'search_performed' AND ev.properties->'filters'->>'country' IS NOT NULL
        GROUP BY filter_val ORDER BY uses DESC LIMIT 10
      ) f
    ), '[]'::jsonb),
    'top_degree_filters', COALESCE((
      SELECT jsonb_agg(row_to_json(f) ORDER BY f.uses DESC)
      FROM (
        SELECT ev.properties->'filters'->>'degree' as filter_val,
               count(*) as uses
        FROM real_ev ev
        WHERE ev.name = 'search_performed' AND ev.properties->'filters'->>'degree' IS NOT NULL
        GROUP BY filter_val ORDER BY uses DESC LIMIT 10
      ) f
    ), '[]'::jsonb)
  ) INTO _search_intel;

  -- ============ CONTENT GAPS ============
  SELECT jsonb_build_object(
    'universities_missing_tuition', COALESCE((
      SELECT jsonb_agg(row_to_json(u) ORDER BY u.views DESC)
      FROM (
        SELECT uni.name_ar, uni.id as slug, 0 as views
        FROM universities uni
        WHERE NOT EXISTS (
          SELECT 1 FROM programs p
          WHERE p.university_id = uni.id AND p.tuition_usd_min IS NOT NULL
        )
        LIMIT 10
      ) u
    ), '[]'::jsonb),
    'programs_missing_deadlines', COALESCE((
      SELECT jsonb_agg(row_to_json(p2) ORDER BY p2.views DESC)
      FROM (
        SELECT p.title_ar as title, uni.name_ar as uni_name, uni.id as uni_slug, 0 as views
        FROM programs p
        JOIN universities uni ON uni.id = p.university_id
        WHERE p.application_deadline IS NULL
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
