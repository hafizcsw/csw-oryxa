-- Update admin_dashboard_summary RPC to include bot latency, registrations, CRM status
CREATE OR REPLACE FUNCTION public.admin_dashboard_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v jsonb := '{}';
begin
  v := jsonb_build_object(
    -- Existing metrics
    'applications_new_24h', coalesce((select count(*) from applications where created_at >= now() - interval '24 hours'),0),
    'p95_results_loaded_ms', coalesce((
      select percentile_disc(0.95) within group (order by (properties->>'latency_ms')::numeric)
      from events 
      where name='results_loaded' and created_at >= now()-interval '7 days'
    ),0),
    'outbox_pending', coalesce((select count(*) from integration_outbox where status='pending'),0),
    'docs_pending', coalesce((select count(*) from application_documents where status='uploaded'),0),
    'contracts_draft', coalesce((select count(*) from contracts where status='draft'),0),
    'slides_active', coalesce((select count(*) from slider_universities where published=true),0),
    'slider_last_update', (select max(updated_at)::text from slider_universities),
    'bot_events_24h', coalesce((
      select count(*) from events 
      where name in ('ingestion_run','harvest_start') and created_at >= now()-interval '24 hours'
    ),0),
    'price_observations_24h', coalesce((
      select count(*) from price_observations where observed_at >= now()-interval '24 hours'
    ),0),
    'tuition_consensus_stale_count', coalesce((
      select count(*) from tuition_consensus where COALESCE(is_stale, false) = true
    ),0),
    'scholarships_draft', coalesce((select count(*) from scholarships where status='draft'),0),
    'scholarships_published', coalesce((select count(*) from scholarships where status='published'),0),
    
    -- Visitors
    'visitors_24h', coalesce((
      select count(distinct coalesce(visitor_id, session_id::text))
      from events 
      where created_at >= now() - interval '24 hours'
    ),0),
    'visitors_7d', coalesce((
      select count(distinct coalesce(visitor_id, session_id::text))
      from events 
      where created_at >= now() - interval '7 days'
    ),0),
    
    -- NEW: Bot response latency metrics
    'bot_avg_latency_ms', coalesce((
      select round(avg((properties->>'latency_ms')::numeric))
      from events 
      where name = 'bot_response' 
      and created_at >= now() - interval '24 hours'
      and properties->>'latency_ms' is not null
    ), 0),
    'bot_p95_latency_ms', coalesce((
      select round(percentile_disc(0.95) within group (order by (properties->>'latency_ms')::numeric))
      from events 
      where name = 'bot_response' 
      and created_at >= now() - interval '24 hours'
      and properties->>'latency_ms' is not null
    ), 0),
    'bot_responses_24h', coalesce((
      select count(*) from events 
      where name = 'bot_response' 
      and created_at >= now() - interval '24 hours'
    ), 0),
    
    -- NEW: Registrations (profiles with user_id linked)
    'registrations_24h', coalesce((
      select count(*) from profiles 
      where user_id is not null 
      and created_at >= now() - interval '24 hours'
    ), 0),
    'registrations_7d', coalesce((
      select count(*) from profiles 
      where user_id is not null 
      and created_at >= now() - interval '7 days'
    ), 0),
    
    -- NEW: Chat sessions
    'chat_sessions_24h', coalesce((
      select count(*) from web_chat_sessions 
      where created_at >= now() - interval '24 hours'
    ), 0),
    'chat_sessions_7d', coalesce((
      select count(*) from web_chat_sessions 
      where created_at >= now() - interval '7 days'
    ), 0),
    
    -- NEW: Active users (visited in last 5 minutes)
    'active_now_5m', coalesce((
      select count(distinct coalesce(visitor_id, session_id::text))
      from events 
      where created_at >= now() - interval '5 minutes'
    ), 0),
    
    -- NEW: Page views
    'pageviews_24h', coalesce((
      select count(*) from events 
      where name = 'page_view' 
      and created_at >= now() - interval '24 hours'
    ), 0),
    
    -- Top routes
    'top_routes_24h', coalesce((
      select jsonb_agg(row_to_json(t))
      from (
        select route, count(*) as pageviews
        from events
        where name = 'page_view' 
        and created_at >= now() - interval '24 hours'
        and route is not null
        group by route
        order by count(*) desc
        limit 5
      ) t
    ), '[]'::jsonb),
    
    -- Recent events
    'events_recent', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', id, 'name', name, 'created_at', created_at, 
          'route', route, 'tab', tab,
          'latency_ms', (properties->>'latency_ms')::int,
          'properties', properties
        )
      ),'[]'::jsonb)
      from (select id, name, created_at, route, tab, properties from events order by created_at desc limit 15) sub
    ),
    
    -- Queues
    'queues', jsonb_build_object(
      'outbox', (
        select coalesce(jsonb_agg(
          jsonb_build_object('id',id,'event_type',event_type,'status',status,'attempts',attempts)
        ),'[]'::jsonb)
        from (select id,event_type,status,attempts from integration_outbox where status='pending' order by created_at limit 5) sub
      ),
      'docs', (
        select coalesce(jsonb_agg(
          jsonb_build_object('id',id,'doc_type',doc_type,'status',status)
        ),'[]'::jsonb)
        from (select id,doc_type,status from application_documents where status='uploaded' order by created_at limit 5) sub
      ),
      'trans', '[]'::jsonb
    )
  );
  
  return v;
end $function$;