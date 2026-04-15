-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule harvest-scheduler to run daily at 2 AM
SELECT cron.schedule(
  'daily-harvest-cycle',
  '0 2 * * *', -- Every day at 2 AM
  $$
  SELECT
    net.http_post(
        url:='https://alkhaznaqdlxygeznapt.supabase.co/functions/v1/harvest-scheduler',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsa2hhem5hcWRseHlnZXpuYXB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MDI1MzAsImV4cCI6MjA3NjA3ODUzMH0.aesgCXo0OpPlj7s-5XQ3x55YwGpVGiWWjCP-9_FkP60"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- View scheduled jobs
SELECT * FROM cron.job;