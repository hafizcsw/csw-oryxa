-- CRM channel guard evidence RPC
-- Q2: forbidden channels
-- Q4: channel vs stamps.channel mismatch
-- Q5: guard rejections/warnings (without polluting telemetry.channel)

CREATE OR REPLACE FUNCTION public.rpc_channel_guard_evidence(p_minutes integer DEFAULT 60)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz := now() - make_interval(mins => GREATEST(COALESCE(p_minutes, 60), 1));
BEGIN
  RETURN jsonb_build_object(
    'query_1', jsonb_build_object('rows', '[]'::jsonb),
    'query_2', jsonb_build_object(
      'rows', COALESCE((
        SELECT jsonb_agg(row_to_json(t))
        FROM (
          SELECT
            e.created_at,
            COALESCE(e.properties->>'channel', e.properties->'telemetry'->>'channel') AS telemetry_channel,
            e.properties->'telemetry'->'inbound'->>'raw_channel' AS raw_channel,
            e.properties->'telemetry'->>'guard_status' AS guard_status,
            e.properties->'telemetry'->>'reason' AS reason
          FROM public.events e
          WHERE e.created_at >= v_since
            AND COALESCE(e.properties->>'channel', e.properties->'telemetry'->>'channel') IS NOT NULL
            AND COALESCE(e.properties->>'channel', e.properties->'telemetry'->>'channel') NOT IN ('web_chat', 'web_portal')
        ) t
      ), '[]'::jsonb)
    ),
    'query_3', jsonb_build_object('rows', '[]'::jsonb),
    'query_4', jsonb_build_object(
      'rows', COALESCE((
        SELECT jsonb_agg(row_to_json(t))
        FROM (
          SELECT
            e.created_at,
            COALESCE(e.properties->>'channel', e.properties->'telemetry'->>'channel') AS telemetry_channel,
            COALESCE(e.properties->'stamps'->>'channel', e.properties->'telemetry'->>'stamps_channel') AS stamps_channel,
            e.properties->'telemetry'->>'guard_status' AS guard_status,
            e.properties->'telemetry'->>'reason' AS reason
          FROM public.events e
          WHERE e.created_at >= v_since
            AND COALESCE(e.properties->>'channel', e.properties->'telemetry'->>'channel') IN ('web_chat', 'web_portal')
            AND COALESCE(e.properties->'stamps'->>'channel', e.properties->'telemetry'->>'stamps_channel') IS NOT NULL
            AND COALESCE(e.properties->>'channel', e.properties->'telemetry'->>'channel')
              <> COALESCE(e.properties->'stamps'->>'channel', e.properties->'telemetry'->>'stamps_channel')
        ) t
      ), '[]'::jsonb)
    ),
    'query_5', jsonb_build_object(
      'rows', COALESCE((
        SELECT jsonb_agg(row_to_json(t))
        FROM (
          SELECT
            e.created_at,
            e.properties->'telemetry'->>'guard_status' AS guard_status,
            e.properties->'telemetry'->>'reason' AS reason,
            COALESCE(e.properties->>'channel', e.properties->'telemetry'->>'channel') AS telemetry_channel,
            e.properties->'telemetry'->'inbound'->>'raw_channel' AS raw_channel
          FROM public.events e
          WHERE e.created_at >= v_since
            AND (
              e.properties->'telemetry'->>'guard_status' = 'rejected'
              OR (e.properties->'telemetry'->>'reason') IN ('forbidden_channel', 'untrusted_ingress', 'proxy_secret_mismatch')
            )
        ) t
      ), '[]'::jsonb)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_channel_guard_evidence(integer) TO service_role;
