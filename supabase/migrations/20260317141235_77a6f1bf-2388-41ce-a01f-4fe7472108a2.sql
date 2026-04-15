-- Decision Analytics RPC: comprehensive analytics for decision dashboard
CREATE OR REPLACE FUNCTION public.decision_analytics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  overview_data jsonb;
  funnel_data jsonb;
  engagement_data jsonb;
  uni_intel jsonb;
  search_intel jsonb;
  content_gaps jsonb;
  c24h timestamptz := now() - interval '24 hours';
  c7d timestamptz := now() - interval '7 days';
  c30d timestamptz := now() - interval '30 days';
  c5m timestamptz := now() - interval '5 minutes';
BEGIN
  -- OVERVIEW
  SELECT jsonb_build_object(
    'visitors_24h', COALESCE((SELECT COUNT(DISTINCT visitor_id) FROM events WHERE name='page_view' AND created_at > c24h), 0),
    'visitors_7d', COALESCE((SELECT COUNT(DISTINCT visitor_id) FROM events WHERE name='page_view' AND created_at > c7d), 0),
    'visitors_30d', COALESCE((SELECT COUNT(DISTINCT visitor_id) FROM events WHERE name='page_view' AND created_at > c30d), 0),
    'active_now', COALESCE((SELECT COUNT(DISTINCT visitor_id) FROM events WHERE created_at > c5m), 0),
    'pageviews_24h', COALESCE((SELECT COUNT(*) FROM events WHERE name='page_view' AND created_at > c24h), 0),
    'pageviews_7d', COALESCE((SELECT COUNT(*) FROM events WHERE name='page_view' AND created_at > c7d), 0),
    'pageviews_30d', COALESCE((SELECT COUNT(*) FROM events WHERE name='page_view' AND created_at > c30d), 0),
    'registrations_24h', COALESCE((SELECT COUNT(*) FROM profiles WHERE created_at > c24h), 0),
    'registrations_7d', COALESCE((SELECT COUNT(*) FROM profiles WHERE created_at > c7d), 0),
    'registrations_30d', COALESCE((SELECT COUNT(*) FROM profiles WHERE created_at > c30d), 0),
    'shortlist_adds_24h', COALESCE((SELECT COUNT(*) FROM events WHERE name='shortlist_add' AND created_at > c24h), 0),
    'shortlist_adds_7d', COALESCE((SELECT COUNT(*) FROM events WHERE name='shortlist_add' AND created_at > c7d), 0),
    'shortlist_adds_30d', COALESCE((SELECT COUNT(*) FROM events WHERE name='shortlist_add' AND created_at > c30d), 0),
    'application_starts_24h', COALESCE((SELECT COUNT(*) FROM applications WHERE created_at::timestamptz > c24h), 0),
    'application_starts_7d', COALESCE((SELECT COUNT(*) FROM applications WHERE created_at::timestamptz > c7d), 0),
    'doc_uploads_24h', COALESCE((SELECT COUNT(*) FROM application_documents WHERE created_at::timestamptz > c24h), 0),
    'chat_sessions_24h', COALESCE((SELECT COUNT(*) FROM chat_sessions WHERE created_at::timestamptz > c24h), 0),
    'chat_sessions_7d', COALESCE((SELECT COUNT(*) FROM chat_sessions WHERE created_at::timestamptz > c7d), 0),
    'returning_visitors_pct', COALESCE((
      SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE visit_days > 1) / NULLIF(COUNT(*), 0))
      FROM (
        SELECT visitor_id, COUNT(DISTINCT created_at::date) as visit_days
        FROM events WHERE name='page_view' AND created_at > c30d AND visitor_id IS NOT NULL
        GROUP BY visitor_id
      ) v
    ), 0),
    'avg_engaged_time_sec', COALESCE((
      SELECT ROUND(AVG(dur))
      FROM (
        SELECT visitor_id, EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) as dur
        FROM events WHERE created_at > c24h AND visitor_id IS NOT NULL
        GROUP BY visitor_id
        HAVING COUNT(*) > 1 AND EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) < 7200
      ) s
    ), 0),
    'daily_trend', COALESCE((
      SELECT jsonb_agg(row_to_json(d)::jsonb ORDER BY d.day)
      FROM (
        SELECT created_at::date as day, COUNT(DISTINCT visitor_id) as visitors, COUNT(*) as pageviews
        FROM events WHERE name='page_view' AND created_at > c30d
        GROUP BY created_at::date ORDER BY day
      ) d
    ), '[]')
  ) INTO overview_data;

  -- FUNNEL (30d)
  SELECT COALESCE(jsonb_agg(row_to_json(f)::jsonb ORDER BY f.step_order), '[]') INTO funnel_data
  FROM (
    SELECT 'landing' as step, 1 as step_order, COUNT(DISTINCT visitor_id)::int as visitors
    FROM events WHERE name='page_view' AND created_at > c30d
    UNION ALL
    SELECT 'search', 2, COUNT(DISTINCT visitor_id)::int
    FROM events WHERE name IN ('filter_changed','results_loaded') AND created_at > c30d
    UNION ALL
    SELECT 'university_view', 3, COUNT(DISTINCT visitor_id)::int
    FROM events WHERE name='page_view' AND created_at > c30d
    AND COALESCE(route, properties->>'route', '') LIKE '/universities/%'
    UNION ALL
    SELECT 'program_view', 4, COUNT(DISTINCT visitor_id)::int
    FROM events WHERE name='page_view' AND created_at > c30d
    AND COALESCE(route, properties->>'route', '') LIKE '/programs/%'
    UNION ALL
    SELECT 'shortlist', 5, COUNT(DISTINCT visitor_id)::int
    FROM events WHERE name='shortlist_add' AND created_at > c30d
    UNION ALL
    SELECT 'register', 6, COUNT(DISTINCT user_id)::int
    FROM profiles WHERE created_at > c30d
    UNION ALL
    SELECT 'apply_click', 7, COUNT(DISTINCT visitor_id)::int
    FROM events WHERE name='apply_clicked' AND created_at > c30d
    UNION ALL
    SELECT 'application', 8, COUNT(DISTINCT visitor_id)::int
    FROM applications WHERE created_at::timestamptz > c30d
    UNION ALL
    SELECT 'doc_upload', 9, COALESCE(COUNT(DISTINCT a.visitor_id), 0)::int
    FROM application_documents ad
    JOIN applications a ON a.id = ad.application_id
    WHERE ad.created_at::timestamptz > c30d
  ) f;

  -- ENGAGEMENT
  SELECT jsonb_build_object(
    'top_pages_by_views', COALESCE((
      SELECT jsonb_agg(row_to_json(r)::jsonb)
      FROM (
        SELECT COALESCE(route, properties->>'route', '/') as page_route,
               COUNT(*) as views, COUNT(DISTINCT visitor_id) as unique_visitors
        FROM events WHERE name='page_view' AND created_at > c7d
        GROUP BY COALESCE(route, properties->>'route', '/') ORDER BY views DESC LIMIT 15
      ) r
    ), '[]'),
    'top_exit_pages', COALESCE((
      SELECT jsonb_agg(row_to_json(r)::jsonb)
      FROM (
        SELECT page_route, COUNT(*) as exit_count FROM (
          SELECT visitor_id, COALESCE(route, properties->>'route', '/') as page_route,
                 ROW_NUMBER() OVER (PARTITION BY visitor_id ORDER BY created_at DESC) as rn
          FROM events WHERE name='page_view' AND created_at > c7d AND visitor_id IS NOT NULL
        ) ranked WHERE rn = 1
        GROUP BY page_route ORDER BY exit_count DESC LIMIT 10
      ) r
    ), '[]'),
    'device_breakdown', COALESCE((
      SELECT jsonb_agg(row_to_json(r)::jsonb)
      FROM (
        SELECT COALESCE(properties->>'device_type', 'desktop') as device,
               COUNT(DISTINCT visitor_id) as visitors
        FROM events WHERE name='page_view' AND created_at > c7d
        GROUP BY properties->>'device_type' ORDER BY visitors DESC
      ) r
    ), '[]'),
    'hourly_pattern', COALESCE((
      SELECT jsonb_agg(row_to_json(r)::jsonb ORDER BY r.hr)
      FROM (
        SELECT EXTRACT(HOUR FROM created_at)::int as hr, COUNT(DISTINCT visitor_id)::int as visitors
        FROM events WHERE name='page_view' AND created_at > c7d
        GROUP BY EXTRACT(HOUR FROM created_at)
      ) r
    ), '[]'),
    'bounce_rate', COALESCE((
      SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE pv_count = 1) / NULLIF(COUNT(*), 0))
      FROM (
        SELECT visitor_id, COUNT(*) as pv_count
        FROM events WHERE name='page_view' AND created_at > c7d AND visitor_id IS NOT NULL
        GROUP BY visitor_id
      ) s
    ), 0)
  ) INTO engagement_data;

  -- UNIVERSITY INTELLIGENCE
  SELECT jsonb_build_object(
    'top_by_views', COALESCE((
      SELECT jsonb_agg(row_to_json(r)::jsonb)
      FROM (
        SELECT u.name as name_ar, u.name_en, u.slug, uv.views, uv.unique_visitors
        FROM (
          SELECT REGEXP_REPLACE(COALESCE(route, properties->>'route'), '^/universities/([^/]+).*$', '\1') as uni_slug,
                 COUNT(*) as views, COUNT(DISTINCT visitor_id) as unique_visitors
          FROM events WHERE name='page_view' AND created_at > c30d
          AND COALESCE(route, properties->>'route', '') ~ '^/universities/[^/]+/?$'
          GROUP BY uni_slug ORDER BY views DESC LIMIT 20
        ) uv
        JOIN universities u ON u.slug = uv.uni_slug
        ORDER BY uv.views DESC
      ) r
    ), '[]'),
    'top_by_shortlist', COALESCE((
      SELECT jsonb_agg(row_to_json(r)::jsonb)
      FROM (
        SELECT properties->>'university_id' as entity_id,
               COUNT(*) as adds, COUNT(DISTINCT visitor_id) as unique_users
        FROM events WHERE name='shortlist_add' AND created_at > c30d
        AND properties->>'university_id' IS NOT NULL
        GROUP BY properties->>'university_id' ORDER BY adds DESC LIMIT 20
      ) r
    ), '[]'),
    'top_programs_by_views', COALESCE((
      SELECT jsonb_agg(row_to_json(r)::jsonb)
      FROM (
        SELECT REGEXP_REPLACE(COALESCE(route, properties->>'route'), '^/programs/([^/]+).*$', '\1') as prog_slug,
               COUNT(*) as views, COUNT(DISTINCT visitor_id) as unique_visitors
        FROM events WHERE name='page_view' AND created_at > c30d
        AND COALESCE(route, properties->>'route', '') ~ '^/programs/[^/]+/?$'
        GROUP BY prog_slug ORDER BY views DESC LIMIT 20
      ) r
    ), '[]')
  ) INTO uni_intel;

  -- SEARCH INTELLIGENCE
  SELECT jsonb_build_object(
    'top_country_filters', COALESCE((
      SELECT jsonb_agg(row_to_json(r)::jsonb)
      FROM (
        SELECT COALESCE(properties->>'country', properties->>'country_slug', 'all') as filter_val,
               COUNT(*) as uses, COUNT(DISTINCT visitor_id) as unique_users
        FROM events WHERE name='filter_changed' AND created_at > c30d
        GROUP BY COALESCE(properties->>'country', properties->>'country_slug', 'all')
        ORDER BY uses DESC LIMIT 15
      ) r
    ), '[]'),
    'top_degree_filters', COALESCE((
      SELECT jsonb_agg(row_to_json(r)::jsonb)
      FROM (
        SELECT COALESCE(properties->>'degree', properties->>'degree_slug', 'all') as filter_val, COUNT(*) as uses
        FROM events WHERE name='filter_changed' AND created_at > c30d
        GROUP BY COALESCE(properties->>'degree', properties->>'degree_slug', 'all')
        ORDER BY uses DESC LIMIT 10
      ) r
    ), '[]'),
    'search_to_click_pct', COALESCE((
      SELECT ROUND(100.0 *
        (SELECT COUNT(DISTINCT visitor_id) FROM events WHERE name='page_view' AND created_at > c30d AND COALESCE(route, properties->>'route', '') ~ '^/universities/[^/]+/?$') /
        NULLIF((SELECT COUNT(DISTINCT visitor_id) FROM events WHERE name IN ('filter_changed','results_loaded') AND created_at > c30d), 0)
      )
    ), 0),
    'search_to_shortlist_pct', COALESCE((
      SELECT ROUND(100.0 *
        (SELECT COUNT(DISTINCT visitor_id) FROM events WHERE name='shortlist_add' AND created_at > c30d) /
        NULLIF((SELECT COUNT(DISTINCT visitor_id) FROM events WHERE name IN ('filter_changed','results_loaded') AND created_at > c30d), 0)
      )
    ), 0),
    'total_searches_30d', COALESCE((SELECT COUNT(*) FROM events WHERE name IN ('filter_changed','results_loaded') AND created_at > c30d), 0)
  ) INTO search_intel;

  -- CONTENT GAPS
  SELECT jsonb_build_object(
    'universities_missing_tuition', COALESCE((
      SELECT jsonb_agg(row_to_json(r)::jsonb)
      FROM (
        SELECT u.name as name_ar, u.slug, uv.views
        FROM (
          SELECT REGEXP_REPLACE(COALESCE(route, properties->>'route'), '^/universities/([^/]+).*$', '\1') as uni_slug, COUNT(*) as views
          FROM events WHERE name='page_view' AND created_at > c30d
          AND COALESCE(route, properties->>'route', '') ~ '^/universities/[^/]+/?$'
          GROUP BY uni_slug HAVING COUNT(*) > 3
        ) uv
        JOIN universities u ON u.slug = uv.uni_slug
        WHERE u.tuition_min IS NULL AND u.tuition_max IS NULL
        AND NOT EXISTS (SELECT 1 FROM programs p WHERE p.university_id = u.id AND p.tuition_yearly IS NOT NULL)
        ORDER BY uv.views DESC LIMIT 10
      ) r
    ), '[]'),
    'programs_missing_deadlines', COALESCE((
      SELECT jsonb_agg(row_to_json(r)::jsonb)
      FROM (
        SELECT p.title, u.name as uni_name, u.slug as uni_slug, pv.views
        FROM (
          SELECT REGEXP_REPLACE(COALESCE(route, properties->>'route'), '^/programs/([^/]+).*$', '\1') as prog_slug, COUNT(*) as views
          FROM events WHERE name='page_view' AND created_at > c30d
          AND COALESCE(route, properties->>'route', '') ~ '^/programs/[^/]+/?$'
          GROUP BY prog_slug HAVING COUNT(*) > 2
        ) pv
        JOIN programs p ON p.program_slug = pv.prog_slug
        JOIN universities u ON u.id = p.university_id
        WHERE p.next_intake_date IS NULL
        ORDER BY pv.views DESC LIMIT 10
      ) r
    ), '[]'),
    'high_traffic_incomplete', COALESCE((
      SELECT jsonb_agg(row_to_json(r)::jsonb)
      FROM (
        SELECT u.name as name_ar, u.slug, uv.views,
          (SELECT COUNT(*) FROM programs p WHERE p.university_id = u.id AND p.published = true) as published_programs,
          (SELECT COUNT(*) FROM programs p WHERE p.university_id = u.id AND p.tuition_yearly IS NOT NULL) as with_tuition
        FROM (
          SELECT REGEXP_REPLACE(COALESCE(route, properties->>'route'), '^/universities/([^/]+).*$', '\1') as uni_slug, COUNT(*) as views
          FROM events WHERE name='page_view' AND created_at > c30d
          AND COALESCE(route, properties->>'route', '') ~ '^/universities/[^/]+/?$'
          GROUP BY uni_slug HAVING COUNT(*) > 5
        ) uv
        JOIN universities u ON u.slug = uv.uni_slug
        ORDER BY uv.views DESC LIMIT 15
      ) r
    ), '[]')
  ) INTO content_gaps;

  -- ASSEMBLE
  result := jsonb_build_object(
    'overview', overview_data,
    'funnel', funnel_data,
    'engagement', engagement_data,
    'university_intel', uni_intel,
    'search_intel', search_intel,
    'content_gaps', content_gaps,
    'generated_at', now()
  );

  RETURN result;
END;
$$;