
CREATE OR REPLACE FUNCTION public.decision_analytics()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  heartbeat_count bigint;
BEGIN
  SELECT COUNT(*) INTO heartbeat_count FROM events WHERE name='engaged_time_heartbeat' AND created_at > c7d LIMIT 100;

  -- OVERVIEW (unchanged logic)
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
    'shortlist_adds_24h', COALESCE((SELECT COUNT(*) FROM events WHERE name IN ('shortlist_add','shortlist_added') AND created_at > c24h), 0),
    'shortlist_adds_7d', COALESCE((SELECT COUNT(*) FROM events WHERE name IN ('shortlist_add','shortlist_added') AND created_at > c7d), 0),
    'shortlist_adds_30d', COALESCE((SELECT COUNT(*) FROM events WHERE name IN ('shortlist_add','shortlist_added') AND created_at > c30d), 0),
    'application_starts_24h', COALESCE((SELECT COUNT(*) FROM applications WHERE created_at::timestamptz > c24h), 0),
    'application_starts_7d', COALESCE((SELECT COUNT(*) FROM applications WHERE created_at::timestamptz > c7d), 0),
    'doc_uploads_24h', COALESCE((SELECT COUNT(*) FROM application_documents WHERE created_at::timestamptz > c24h), 0),
    'chat_sessions_24h', COALESCE((SELECT COUNT(*) FROM chat_sessions WHERE created_at::timestamptz > c24h), 0),
    'chat_sessions_7d', COALESCE((SELECT COUNT(*) FROM chat_sessions WHERE created_at::timestamptz > c7d), 0),
    'returning_visitors_pct', COALESCE((
      SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE visit_days > 1) / NULLIF(COUNT(*), 0))
      FROM (SELECT visitor_id, COUNT(DISTINCT created_at::date) as visit_days FROM events WHERE name='page_view' AND created_at > c30d AND visitor_id IS NOT NULL GROUP BY visitor_id) v
    ), 0),
    'avg_engaged_time_sec', CASE WHEN heartbeat_count > 0 THEN
      COALESCE((SELECT ROUND(AVG(engaged_seconds)) FROM (SELECT session_id, MAX((properties->>'engaged_seconds')::numeric) as engaged_seconds FROM events WHERE name='engaged_time_heartbeat' AND created_at > c24h AND session_id IS NOT NULL GROUP BY session_id) hb), 0)
    ELSE
      COALESCE((SELECT ROUND(AVG(dur)) FROM (SELECT session_id, EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) as dur FROM events WHERE created_at > c24h AND session_id IS NOT NULL GROUP BY session_id HAVING COUNT(*) > 1 AND EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) < 7200) s), 0)
    END,
    'engaged_time_source', CASE WHEN heartbeat_count > 0 THEN 'heartbeat' ELSE 'session_estimate' END,
    'daily_trend', COALESCE((SELECT jsonb_agg(row_to_json(d)::jsonb ORDER BY d.day) FROM (SELECT created_at::date as day, COUNT(DISTINCT visitor_id) as visitors, COUNT(*) as pageviews FROM events WHERE name='page_view' AND created_at > c30d GROUP BY created_at::date ORDER BY day) d), '[]')
  ) INTO overview_data;

  -- FUNNEL: entity-level blending (not visitor/type suppression)
  -- For university_view and program_view, we UNION entity_view rows with route-only rows
  -- suppressing route fallback ONLY for the SAME entity slug + visitor pair, not globally
  SELECT COALESCE(jsonb_agg(row_to_json(f)::jsonb ORDER BY f.step_order), '[]') INTO funnel_data
  FROM (
    SELECT 'landing' as step, 1 as step_order, COUNT(DISTINCT visitor_id)::int as visitors, 'visitor_id' as identity_domain
    FROM events WHERE name='page_view' AND created_at > c30d
    UNION ALL
    SELECT 'search_page', 2, COUNT(DISTINCT visitor_id)::int, 'visitor_id'
    FROM events WHERE name='page_view' AND created_at > c30d AND COALESCE(route,'') LIKE '%search%'
    UNION ALL
    SELECT 'search_performed', 3, COUNT(DISTINCT visitor_id)::int, 'visitor_id'
    FROM events WHERE name='search_performed' AND created_at > c30d
    UNION ALL
    -- University view: entity-level dedup (per visitor+slug pair)
    SELECT 'university_view', 4, COUNT(DISTINCT visitor_id)::int, 'visitor_id'
    FROM (
      SELECT visitor_id FROM events WHERE name='entity_view' AND properties->>'entity_type'='university' AND created_at > c30d
      UNION
      SELECT e.visitor_id FROM events e
      WHERE e.name='page_view' AND e.created_at > c30d AND COALESCE(e.route,'') ~ '^/universities/[^/]+'
        AND NOT EXISTS (
          SELECT 1 FROM events e2
          WHERE e2.name='entity_view' AND e2.visitor_id = e.visitor_id
            AND e2.properties->>'entity_type'='university'
            AND e2.properties->>'entity_slug' = REGEXP_REPLACE(COALESCE(e.route,''), '^/universities/([^/]+).*$', '\1')
            AND e2.created_at > c30d
        )
    ) uni_visitors
    UNION ALL
    -- Program view: entity-level dedup (per visitor+slug pair)
    SELECT 'program_view', 5, COUNT(DISTINCT visitor_id)::int, 'visitor_id'
    FROM (
      SELECT visitor_id FROM events WHERE name='entity_view' AND properties->>'entity_type'='program' AND created_at > c30d
      UNION
      SELECT e.visitor_id FROM events e
      WHERE e.name='page_view' AND e.created_at > c30d AND COALESCE(e.route,'') ~ '^/programs/[^/]+'
        AND NOT EXISTS (
          SELECT 1 FROM events e2
          WHERE e2.name='entity_view' AND e2.visitor_id = e.visitor_id
            AND e2.properties->>'entity_type'='program'
            AND e2.properties->>'entity_slug' = REGEXP_REPLACE(COALESCE(e.route,''), '^/programs/([^/]+).*$', '\1')
            AND e2.created_at > c30d
        )
    ) prog_visitors
    UNION ALL
    SELECT 'shortlist', 6, COUNT(DISTINCT visitor_id)::int, 'visitor_id'
    FROM events WHERE name IN ('shortlist_add','shortlist_added') AND created_at > c30d
    UNION ALL
    SELECT 'register', 7, COUNT(DISTINCT user_id)::int, 'user_id'
    FROM profiles WHERE created_at > c30d
    UNION ALL
    SELECT 'application', 8, COUNT(DISTINCT visitor_id)::int, 'visitor_id'
    FROM applications WHERE created_at::timestamptz > c30d
    UNION ALL
    SELECT 'doc_upload', 9, COALESCE(COUNT(DISTINCT a.visitor_id), 0)::int, 'visitor_id'
    FROM application_documents ad JOIN applications a ON a.id = ad.application_id WHERE ad.created_at::timestamptz > c30d
  ) f;

  -- ENGAGEMENT (unchanged)
  SELECT jsonb_build_object(
    'top_pages_by_views', COALESCE((SELECT jsonb_agg(row_to_json(r)::jsonb) FROM (SELECT COALESCE(route, '/') as page_route, COUNT(*) as views, COUNT(DISTINCT visitor_id) as unique_visitors FROM events WHERE name='page_view' AND created_at > c7d GROUP BY COALESCE(route, '/') ORDER BY views DESC LIMIT 15) r), '[]'),
    'top_exit_pages', COALESCE((SELECT jsonb_agg(row_to_json(r)::jsonb) FROM (SELECT page_route, COUNT(*) as exit_count FROM (SELECT session_id, COALESCE(route, '/') as page_route, ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at DESC) as rn FROM events WHERE name='page_view' AND created_at > c7d AND session_id IS NOT NULL) ranked WHERE rn = 1 GROUP BY page_route ORDER BY exit_count DESC LIMIT 10) r), '[]'),
    'device_breakdown', COALESCE((SELECT jsonb_agg(row_to_json(r)::jsonb) FROM (SELECT COALESCE(properties->>'device_type', 'desktop') as device, COUNT(DISTINCT visitor_id) as visitors FROM events WHERE name='page_view' AND created_at > c7d GROUP BY properties->>'device_type' ORDER BY visitors DESC) r), '[]'),
    'hourly_pattern', COALESCE((SELECT jsonb_agg(row_to_json(r)::jsonb ORDER BY r.hr) FROM (SELECT EXTRACT(HOUR FROM created_at)::int as hr, COUNT(DISTINCT visitor_id)::int as visitors FROM events WHERE name='page_view' AND created_at > c7d GROUP BY EXTRACT(HOUR FROM created_at)) r), '[]'),
    'bounce_rate', COALESCE((SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE pv_count = 1) / NULLIF(COUNT(*), 0)) FROM (SELECT session_id, COUNT(*) as pv_count FROM events WHERE name='page_view' AND created_at > c7d AND session_id IS NOT NULL GROUP BY session_id) s), 0),
    'bounce_basis', 'session'
  ) INTO engagement_data;

  -- UNIVERSITY INTEL: entity-level blending (per visitor+slug pair, not visitor/type)
  SELECT jsonb_build_object(
    'top_by_views', COALESCE((
      SELECT jsonb_agg(row_to_json(r)::jsonb) FROM (
        SELECT u.name as name_ar, u.name_en, u.slug, SUM(blended.cnt)::bigint as views, COUNT(DISTINCT blended.vid)::bigint as unique_visitors
        FROM (
          -- entity_view events (primary)
          SELECT e.properties->>'entity_slug' as uni_slug, e.visitor_id as vid, COUNT(*) as cnt
          FROM events e WHERE e.name='entity_view' AND e.properties->>'entity_type'='university' AND e.created_at > c30d
          GROUP BY 1, 2
          UNION ALL
          -- route fallback: only for visitor+slug pairs that have NO entity_view for THAT SPECIFIC slug
          SELECT REGEXP_REPLACE(COALESCE(e.route,''), '^/universities/([^/]+).*$', '\1') as uni_slug, e.visitor_id, COUNT(*)
          FROM events e
          WHERE e.name='page_view' AND e.created_at > c30d AND COALESCE(e.route,'') ~ '^/universities/[^/]+'
            AND NOT EXISTS (
              SELECT 1 FROM events e2
              WHERE e2.name='entity_view' AND e2.visitor_id = e.visitor_id
                AND e2.properties->>'entity_type'='university'
                AND e2.properties->>'entity_slug' = REGEXP_REPLACE(COALESCE(e.route,''), '^/universities/([^/]+).*$', '\1')
                AND e2.created_at > c30d
            )
          GROUP BY 1, 2
        ) blended
        JOIN universities u ON u.slug = blended.uni_slug
        GROUP BY u.name, u.name_en, u.slug ORDER BY views DESC LIMIT 20
      ) r
    ), '[]'),
    'top_by_shortlist', COALESCE((
      SELECT jsonb_agg(row_to_json(r)::jsonb) FROM (
        SELECT COALESCE(u.name, sl.eid) as name_ar, u.name_en, u.slug, u.id::text as entity_id, sl.adds, sl.unique_users
        FROM (SELECT COALESCE(properties->>'university_id', properties->>'entity_id') as eid, COUNT(*) as adds, COUNT(DISTINCT visitor_id) as unique_users FROM events WHERE name IN ('shortlist_add','shortlist_added') AND created_at > c30d AND (properties->>'university_id' IS NOT NULL OR properties->>'entity_id' IS NOT NULL) GROUP BY eid ORDER BY adds DESC LIMIT 20) sl
        LEFT JOIN universities u ON u.id::text = sl.eid OR u.slug = sl.eid ORDER BY sl.adds DESC
      ) r
    ), '[]'),
    'top_programs_by_views', COALESCE((
      SELECT jsonb_agg(row_to_json(r)::jsonb) FROM (
        SELECT
          COALESCE(MIN(p.title), blended.prog_slug) as program_title,
          MIN(u.name) as university_name,
          blended.prog_slug,
          SUM(blended.cnt)::bigint as views,
          COUNT(DISTINCT blended.vid)::bigint as unique_visitors
        FROM (
          -- entity_view events (primary)
          SELECT COALESCE(e.properties->>'entity_slug', e.properties->>'entity_id') as prog_slug, e.visitor_id as vid, COUNT(*) as cnt
          FROM events e WHERE e.name='entity_view' AND e.properties->>'entity_type'='program' AND e.created_at > c30d
          GROUP BY 1, 2
          UNION ALL
          -- route fallback: per visitor+slug pair dedup
          SELECT REGEXP_REPLACE(COALESCE(e.route,''), '^/programs/([^/]+).*$', '\1') as prog_slug, e.visitor_id, COUNT(*)
          FROM events e
          WHERE e.name='page_view' AND e.created_at > c30d AND COALESCE(e.route,'') ~ '^/programs/[^/]+'
            AND NOT EXISTS (
              SELECT 1 FROM events e2
              WHERE e2.name='entity_view' AND e2.visitor_id = e.visitor_id
                AND e2.properties->>'entity_type'='program'
                AND COALESCE(e2.properties->>'entity_slug', e2.properties->>'entity_id') = REGEXP_REPLACE(COALESCE(e.route,''), '^/programs/([^/]+).*$', '\1')
                AND e2.created_at > c30d
            )
          GROUP BY 1, 2
        ) blended
        LEFT JOIN programs p ON p.program_slug = blended.prog_slug OR p.id::text = blended.prog_slug
        LEFT JOIN universities u ON u.id = p.university_id
        GROUP BY blended.prog_slug ORDER BY views DESC LIMIT 20
      ) r
    ), '[]'),
    'data_source', 'blended_entity_and_route_per_slug'
  ) INTO uni_intel;

  -- SEARCH INTEL (visitor_id only, unchanged)
  SELECT jsonb_build_object(
    'top_country_filters', COALESCE((SELECT jsonb_agg(row_to_json(r)::jsonb) FROM (SELECT COALESCE(properties->'filters'->>'country', 'all') as filter_val, COUNT(*) as uses, COUNT(DISTINCT visitor_id) as unique_users FROM events WHERE name='search_performed' AND created_at > c30d GROUP BY filter_val ORDER BY uses DESC LIMIT 15) r), '[]'),
    'top_degree_filters', COALESCE((SELECT jsonb_agg(row_to_json(r)::jsonb) FROM (SELECT COALESCE(properties->'filters'->>'degree', 'all') as filter_val, COUNT(*) as uses FROM events WHERE name='search_performed' AND created_at > c30d GROUP BY filter_val ORDER BY uses DESC LIMIT 10) r), '[]'),
    'search_to_click_pct', COALESCE((SELECT ROUND(100.0 * (SELECT COUNT(DISTINCT visitor_id) FROM events WHERE name='search_result_click' AND created_at > c30d)::numeric / NULLIF((SELECT COUNT(DISTINCT visitor_id) FROM events WHERE name='search_performed' AND created_at > c30d), 0))), 0),
    'search_to_shortlist_pct', COALESCE((SELECT ROUND(100.0 * (SELECT COUNT(DISTINCT visitor_id) FROM events WHERE name IN ('shortlist_add','shortlist_added') AND created_at > c30d)::numeric / NULLIF((SELECT COUNT(DISTINCT visitor_id) FROM events WHERE name='search_performed' AND created_at > c30d), 0))), 0),
    'total_searches_30d', COALESCE((SELECT COUNT(*) FROM events WHERE name='search_performed' AND created_at > c30d), 0),
    'attribution_method', 'visitor_based_proxy'
  ) INTO search_intel;

  -- CONTENT GAPS: per-slug blending (no global entity_view_count switch)
  SELECT jsonb_build_object(
    'universities_missing_tuition', COALESCE((
      SELECT jsonb_agg(row_to_json(r)::jsonb) FROM (
        SELECT u.name as name_ar, u.slug, uv.views FROM (
          SELECT uni_slug, SUM(cnt)::bigint as views FROM (
            -- entity_view primary
            SELECT properties->>'entity_slug' as uni_slug, COUNT(*) as cnt
            FROM events WHERE name='entity_view' AND properties->>'entity_type'='university' AND created_at > c30d GROUP BY 1
            UNION ALL
            -- route fallback: per-slug dedup (only add route counts for slugs with NO entity_view at all)
            SELECT slug_extracted, COUNT(*) FROM (
              SELECT REGEXP_REPLACE(COALESCE(route,''), '^/universities/([^/]+).*$', '\1') as slug_extracted
              FROM events WHERE name='page_view' AND created_at > c30d AND COALESCE(route,'') ~ '^/universities/[^/]+/?$'
            ) rv
            WHERE NOT EXISTS (
              SELECT 1 FROM events e2 WHERE e2.name='entity_view' AND e2.properties->>'entity_type'='university'
                AND e2.properties->>'entity_slug' = rv.slug_extracted AND e2.created_at > c30d
            )
            GROUP BY slug_extracted
          ) combined GROUP BY uni_slug HAVING SUM(cnt) > 3
        ) uv
        JOIN universities u ON u.slug = uv.uni_slug
        WHERE u.tuition_min IS NULL AND u.tuition_max IS NULL AND NOT EXISTS (SELECT 1 FROM programs p WHERE p.university_id = u.id AND p.tuition_yearly IS NOT NULL)
        ORDER BY uv.views DESC LIMIT 10
      ) r
    ), '[]'),
    'programs_missing_deadlines', COALESCE((
      SELECT jsonb_agg(row_to_json(r)::jsonb) FROM (
        SELECT p.title, u.name as uni_name, u.slug as uni_slug, pv.views FROM (
          SELECT prog_slug, SUM(cnt)::bigint as views FROM (
            SELECT properties->>'entity_slug' as prog_slug, COUNT(*) as cnt
            FROM events WHERE name='entity_view' AND properties->>'entity_type'='program' AND created_at > c30d GROUP BY 1
            UNION ALL
            SELECT slug_extracted, COUNT(*) FROM (
              SELECT REGEXP_REPLACE(COALESCE(route,''), '^/programs/([^/]+).*$', '\1') as slug_extracted
              FROM events WHERE name='page_view' AND created_at > c30d AND COALESCE(route,'') ~ '^/programs/[^/]+/?$'
            ) rv
            WHERE NOT EXISTS (
              SELECT 1 FROM events e2 WHERE e2.name='entity_view' AND e2.properties->>'entity_type'='program'
                AND e2.properties->>'entity_slug' = rv.slug_extracted AND e2.created_at > c30d
            )
            GROUP BY slug_extracted
          ) combined GROUP BY prog_slug HAVING SUM(cnt) > 2
        ) pv
        JOIN programs p ON p.program_slug = pv.prog_slug JOIN universities u ON u.id = p.university_id
        WHERE p.next_intake_date IS NULL ORDER BY pv.views DESC LIMIT 10
      ) r
    ), '[]'),
    'high_traffic_incomplete', COALESCE((
      SELECT jsonb_agg(row_to_json(r)::jsonb) FROM (
        SELECT u.name as name_ar, u.slug, uv.views,
          (SELECT COUNT(*) FROM programs p WHERE p.university_id = u.id AND p.published = true) as published_programs,
          (SELECT COUNT(*) FROM programs p WHERE p.university_id = u.id AND p.tuition_yearly IS NOT NULL) as with_tuition
        FROM (
          SELECT uni_slug, SUM(cnt)::bigint as views FROM (
            SELECT properties->>'entity_slug' as uni_slug, COUNT(*) as cnt
            FROM events WHERE name='entity_view' AND properties->>'entity_type'='university' AND created_at > c30d GROUP BY 1
            UNION ALL
            SELECT slug_extracted, COUNT(*) FROM (
              SELECT REGEXP_REPLACE(COALESCE(route,''), '^/universities/([^/]+).*$', '\1') as slug_extracted
              FROM events WHERE name='page_view' AND created_at > c30d AND COALESCE(route,'') ~ '^/universities/[^/]+/?$'
            ) rv
            WHERE NOT EXISTS (
              SELECT 1 FROM events e2 WHERE e2.name='entity_view' AND e2.properties->>'entity_type'='university'
                AND e2.properties->>'entity_slug' = rv.slug_extracted AND e2.created_at > c30d
            )
            GROUP BY slug_extracted
          ) combined GROUP BY uni_slug HAVING SUM(cnt) > 5
        ) uv
        JOIN universities u ON u.slug = uv.uni_slug ORDER BY uv.views DESC LIMIT 15
      ) r
    ), '[]')
  ) INTO content_gaps;

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
$function$;
