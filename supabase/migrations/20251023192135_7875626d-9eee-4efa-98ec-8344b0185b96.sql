-- Security Fix: Add RLS policies for critical tables and fix SECURITY DEFINER functions

-- 1. Enable RLS on critical tables
ALTER TABLE application_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- 2. Add RLS policies for application_documents
CREATE POLICY "application_documents_admin_all"
ON application_documents
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- 3. Add RLS policies for application_programs
CREATE POLICY "application_programs_admin_all"
ON application_programs
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- 4. Add RLS policies for admin_audit (admin only)
CREATE POLICY "admin_audit_select"
ON admin_audit
FOR SELECT
USING (is_admin(auth.uid()));

-- 5. Add RLS policies for analytics_events (admin only)
CREATE POLICY "analytics_events_admin_all"
ON analytics_events
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- 6. Add RLS policies for rate_limits (service role only via functions)
CREATE POLICY "rate_limits_service_only"
ON rate_limits
FOR ALL
USING (false)
WITH CHECK (false);

-- 7. Fix SECURITY DEFINER functions - add SET search_path
CREATE OR REPLACE FUNCTION public.admin_dashboard_summary()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'applications_new_24h', (
      SELECT count(*) FROM applications 
      WHERE created_at > now() - interval '24 hours'
    ),
    'p95_results_loaded_ms', (
      SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)
      FROM analytics_events
      WHERE event = 'results_loaded'
        AND at > now() - interval '7 days'
    ),
    'outbox_pending', (
      SELECT count(*) FROM integration_outbox WHERE status = 'pending'
    ),
    'docs_pending', (
      SELECT count(*) FROM application_documents WHERE status = 'uploaded'
    ),
    'contracts_draft', (
      SELECT count(*) FROM contracts WHERE status = 'draft'
    ),
    'slides_active', (
      SELECT count(*) FROM slider_universities WHERE enabled = true
    ),
    'slider_last_update', (
      SELECT max(updated_at)::text FROM slider_universities
    ),
    'bot_events_24h', (
      SELECT count(*) FROM events 
      WHERE name IN ('ingestion_run', 'harvest_start')
        AND created_at > now() - interval '24 hours'
    ),
    'price_observations_24h', (
      SELECT count(*) FROM price_observations 
      WHERE observed_at > now() - interval '24 hours'
    ),
    'tuition_consensus_stale_count', (
      SELECT count(*) FROM tuition_consensus WHERE is_stale = true
    ),
    'scholarships_draft', (
      SELECT count(*) FROM scholarships WHERE status = 'draft'
    ),
    'scholarships_published', (
      SELECT count(*) FROM scholarships WHERE status = 'published'
    ),
    'events_recent', (
      SELECT json_agg(
        json_build_object(
          'id', id,
          'name', name,
          'created_at', created_at,
          'properties', properties
        )
      )
      FROM (
        SELECT id, name, created_at, properties
        FROM events
        ORDER BY created_at DESC
        LIMIT 10
      ) sub
    ),
    'queues', json_build_object(
      'outbox', (
        SELECT json_agg(
          json_build_object(
            'id', id,
            'event_type', event_type,
            'status', status,
            'attempts', attempts
          )
        )
        FROM (
          SELECT id, event_type, status, attempts
          FROM integration_outbox
          WHERE status = 'pending'
          ORDER BY created_at
          LIMIT 5
        ) sub
      ),
      'docs', (
        SELECT json_agg(
          json_build_object(
            'id', id,
            'doc_type', doc_type,
            'status', status
          )
        )
        FROM (
          SELECT id, doc_type, status
          FROM application_documents
          WHERE status = 'uploaded'
          ORDER BY created_at
          LIMIT 5
        ) sub
      ),
      'trans', (
        SELECT json_agg(
          json_build_object(
            'id', id,
            'status', status
          )
        )
        FROM (
          SELECT id, 'pending' as status
          FROM translation_requests
          WHERE status = 'pending'
          ORDER BY created_at
          LIMIT 5
        ) sub
      )
    )
  ) INTO result;
  
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_add_status(p_application_id uuid, p_status text, p_note text, p_created_by text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
declare
  v_visitor text;
  v_phone text;
begin
  update applications
     set status = p_status
   where id = p_application_id;

  insert into application_status_events(application_id, status, note, created_by)
  values (p_application_id, p_status, p_note, coalesce(p_created_by, 'system'));

  select visitor_id into v_visitor from applications where id = p_application_id;
  if v_visitor is not null then
    select phone into v_phone from phone_identities where visitor_id = v_visitor limit 1;

    if v_phone is not null then
      insert into notifications(visitor_id, application_id, channel, template_key, payload)
      values (v_visitor, p_application_id, 'whatsapp', 'application_status_update',
              jsonb_build_object('status', p_status, 'note', p_note, 'phone', v_phone));
    end if;
  end if;

  insert into integration_events(event_name, target, payload, idempotency_key, status)
  values ('application.status_changed', 'crm',
          jsonb_build_object('application_id', p_application_id, 'status', p_status, 'note', p_note),
          'app_status:'||p_application_id||':'||p_status||':'||to_char(now(),'YYYYMMDDHH24MI'),
          'queued')
  on conflict (idempotency_key) do nothing;
end $function$;

CREATE OR REPLACE FUNCTION public.app_docs_approve_all(p_application_id uuid, p_reviewer_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_visitor text;
  v_phone text;
  v_result jsonb;
BEGIN
  UPDATE application_documents
  SET status = 'approved'
  WHERE application_id = p_application_id AND status IN ('uploaded', 'pending');
  
  INSERT INTO application_status_events(application_id, status, note, created_by, channel)
  VALUES (p_application_id, 'docs_approved', 'All documents approved', p_reviewer_id, 'admin');
  
  SELECT visitor_id INTO v_visitor FROM applications WHERE id = p_application_id;
  IF v_visitor IS NOT NULL THEN
    SELECT phone INTO v_phone FROM phone_identities WHERE visitor_id = v_visitor LIMIT 1;
    
    IF v_phone IS NOT NULL THEN
      INSERT INTO notifications(visitor_id, application_id, channel, template_key, payload, status)
      VALUES (v_visitor, p_application_id, 'whatsapp', 'docs_approved',
              jsonb_build_object('phone', v_phone), 'queued');
    END IF;
  END IF;
  
  INSERT INTO events(name, visitor_id, properties)
  VALUES ('doc_status_changed', v_visitor, jsonb_build_object(
    'application_id', p_application_id,
    'status', 'approved',
    'reviewer_id', p_reviewer_id
  ));
  
  v_result := jsonb_build_object(
    'ok', true,
    'application_id', p_application_id,
    'status', 'docs_approved'
  );
  
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_docs_reject(p_application_id uuid, p_reviewer_id text, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_visitor text;
  v_phone text;
  v_result jsonb;
BEGIN
  UPDATE application_documents
  SET status = 'rejected'
  WHERE application_id = p_application_id;
  
  INSERT INTO application_status_events(application_id, status, note, created_by, channel)
  VALUES (p_application_id, 'docs_rejected', p_reason, p_reviewer_id, 'admin');
  
  SELECT visitor_id INTO v_visitor FROM applications WHERE id = p_application_id;
  IF v_visitor IS NOT NULL THEN
    SELECT phone INTO v_phone FROM phone_identities WHERE visitor_id = v_visitor LIMIT 1;
    
    IF v_phone IS NOT NULL THEN
      INSERT INTO notifications(visitor_id, application_id, channel, template_key, payload, status)
      VALUES (v_visitor, p_application_id, 'whatsapp', 'docs_rejected',
              jsonb_build_object('phone', v_phone, 'reason', p_reason), 'queued');
    END IF;
  END IF;
  
  INSERT INTO events(name, visitor_id, properties)
  VALUES ('doc_status_changed', v_visitor, jsonb_build_object(
    'application_id', p_application_id,
    'status', 'rejected',
    'reason', p_reason,
    'reviewer_id', p_reviewer_id
  ));
  
  v_result := jsonb_build_object(
    'ok', true,
    'application_id', p_application_id,
    'status', 'docs_rejected',
    'reason', p_reason
  );
  
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_payment_success(p_application_id uuid, p_payment_ref text, p_amount numeric, p_currency text DEFAULT 'USD'::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_visitor text;
  v_phone text;
  v_result jsonb;
BEGIN
  UPDATE applications
  SET status = 'paid'
  WHERE id = p_application_id;
  
  INSERT INTO application_status_events(application_id, status, note, created_by, channel)
  VALUES (p_application_id, 'paid', 
          format('Payment successful: %s %s (ref: %s)', p_amount, p_currency, p_payment_ref),
          'payment_gateway', 'system');
  
  SELECT visitor_id INTO v_visitor FROM applications WHERE id = p_application_id;
  IF v_visitor IS NOT NULL THEN
    SELECT phone INTO v_phone FROM phone_identities WHERE visitor_id = v_visitor LIMIT 1;
    
    IF v_phone IS NOT NULL THEN
      INSERT INTO notifications(visitor_id, application_id, channel, template_key, payload, status)
      VALUES (v_visitor, p_application_id, 'whatsapp', 'payment_success',
              jsonb_build_object('phone', v_phone, 'amount', p_amount, 'currency', p_currency), 
              'queued');
    END IF;
  END IF;
  
  INSERT INTO events(name, visitor_id, properties)
  VALUES ('payment_success', v_visitor, jsonb_build_object(
    'application_id', p_application_id,
    'amount', p_amount,
    'currency', p_currency,
    'payment_ref', p_payment_ref
  ));
  
  v_result := jsonb_build_object(
    'ok', true,
    'application_id', p_application_id,
    'status', 'paid',
    'payment_ref', p_payment_ref
  );
  
  RETURN v_result;
END;
$function$;