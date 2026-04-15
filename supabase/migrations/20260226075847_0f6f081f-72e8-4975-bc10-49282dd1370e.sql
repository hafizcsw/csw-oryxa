
-- Create a function that calls the orchestrator tick via pg_net
CREATE OR REPLACE FUNCTION public.osc_auto_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
  v_status text;
BEGIN
  -- Find the active crawling job
  SELECT id, status INTO v_job_id, v_status
  FROM official_site_crawl_jobs
  WHERE status = 'crawling'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_job_id IS NULL THEN
    -- No active job, unschedule ourselves
    PERFORM cron.unschedule('osc-auto-tick');
    RETURN;
  END IF;

  -- Check if kill_switch is on
  IF (SELECT kill_switch FROM official_site_crawl_jobs WHERE id = v_job_id) THEN
    RETURN;
  END IF;

  -- Fire tick via pg_net
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/official-site-crawl-orchestrator',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('action', 'tick', 'job_id', v_job_id::text)
  );
END;
$$;

-- Schedule tick every 8 seconds
SELECT cron.schedule('osc-auto-tick', '8 seconds', 'SELECT public.osc_auto_tick()');
