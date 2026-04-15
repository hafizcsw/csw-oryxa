-- pg_cron job to tick the QS full crawl orchestrator every 30 seconds
SELECT cron.schedule(
  'qs-full-crawl-tick',
  '30 seconds',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1) || '/functions/v1/qs-full-crawl-orchestrator',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{"action":"tick"}'::jsonb
  );
  $$
);