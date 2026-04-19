-- Schedule Door 3 dispatcher every minute
SELECT cron.schedule(
  'door3-job-dispatcher-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://pkivavsxbvwtnkgxaufa.supabase.co/functions/v1/door3-job-dispatcher',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBraXZhdnN4YnZ3dG5rZ3hhdWZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5ODY3NzYsImV4cCI6MjA5MTU2Mjc3Nn0.jYZe5WnjINZdXT9tmizxxfbd1jT4wJ277kdD1nTl1Gs"}'::jsonb,
    body := jsonb_build_object('triggered_at', now())
  );
  $$
);