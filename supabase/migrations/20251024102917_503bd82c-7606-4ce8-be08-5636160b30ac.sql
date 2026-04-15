-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create helper function for cron status
CREATE OR REPLACE FUNCTION public.seo_cron_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gsc_scheduled boolean := false;
  bl_scheduled boolean := false;
  result jsonb;
BEGIN
  -- Check if jobs exist in cron.job table
  SELECT EXISTS(
    SELECT 1 FROM cron.job WHERE jobname = 'gsc_sync_daily'
  ) INTO gsc_scheduled;

  SELECT EXISTS(
    SELECT 1 FROM cron.job WHERE jobname = 'backlinks_auto_import_hourly'
  ) INTO bl_scheduled;

  -- Get flags
  result := jsonb_build_object(
    'gsc_job', gsc_scheduled,
    'backlinks_job', bl_scheduled,
    'flags', (
      SELECT jsonb_object_agg(key, value)
      FROM feature_settings
      WHERE key IN ('gsc_sync_enabled', 'backlinks_auto_import_enabled')
    )
  );

  RETURN result;
END;
$$;

-- Create function to enable/disable cron jobs
CREATE OR REPLACE FUNCTION public.seo_cron_apply(
  _enable boolean,
  _gsc boolean,
  _backlinks boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  edge_url text;
  srv_key text;
BEGIN
  -- Check admin permission
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Get environment variables
  edge_url := current_setting('app.supabase_url', true);
  srv_key := current_setting('app.service_role_key', true);

  -- Update flags
  IF _gsc THEN
    INSERT INTO feature_settings(key, value) 
    VALUES('gsc_sync_enabled', CASE WHEN _enable THEN 'true' ELSE 'false' END)
    ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value;
  END IF;

  IF _backlinks THEN
    INSERT INTO feature_settings(key, value) 
    VALUES('backlinks_auto_import_enabled', CASE WHEN _enable THEN 'true' ELSE 'false' END)
    ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value;
  END IF;

  -- Handle GSC job
  IF _gsc THEN
    IF _enable THEN
      -- Remove existing job if any
      PERFORM cron.unschedule('gsc_sync_daily');
      
      -- Schedule new job
      PERFORM cron.schedule(
        'gsc_sync_daily',
        '5 3 * * *',
        format(
          'SELECT net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb)',
          edge_url || '/functions/v1/gsc-sync',
          '{"Authorization":"Bearer ' || srv_key || '","Content-Type":"application/json"}',
          '{"reason":"cron"}'
        )
      );
    ELSE
      PERFORM cron.unschedule('gsc_sync_daily');
    END IF;
  END IF;

  -- Handle backlinks job
  IF _backlinks THEN
    IF _enable THEN
      -- Remove existing job if any
      PERFORM cron.unschedule('backlinks_auto_import_hourly');
      
      -- Schedule new job
      PERFORM cron.schedule(
        'backlinks_auto_import_hourly',
        '15 * * * *',
        format(
          'SELECT net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb)',
          edge_url || '/functions/v1/backlinks-auto-import',
          '{"Authorization":"Bearer ' || srv_key || '","Content-Type":"application/json"}',
          '{"reason":"cron"}'
        )
      );
    ELSE
      PERFORM cron.unschedule('backlinks_auto_import_hourly');
    END IF;
  END IF;

  -- Return updated status
  RETURN public.seo_cron_status();
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.seo_cron_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.seo_cron_apply(boolean, boolean, boolean) TO authenticated;