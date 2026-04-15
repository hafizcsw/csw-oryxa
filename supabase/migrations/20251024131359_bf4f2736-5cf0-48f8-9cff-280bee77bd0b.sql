-- Fix missing is_stale column in tuition_consensus
ALTER TABLE tuition_consensus 
ADD COLUMN IF NOT EXISTS is_stale BOOLEAN DEFAULT false;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_tuition_consensus_stale ON tuition_consensus(is_stale);

-- Fix admin_dashboard_summary function to handle missing columns gracefully
CREATE OR REPLACE FUNCTION admin_dashboard_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare v jsonb := '{}';
begin
  v := jsonb_build_object(
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
    'events_recent', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', id, 'name', name, 'created_at', created_at, 'properties', properties
        )
      ),'[]'::jsonb)
      from (select id, name, created_at, properties from events order by created_at desc limit 10) sub
    ),
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
      )
    )
  );
  
  return v;
end $function$;