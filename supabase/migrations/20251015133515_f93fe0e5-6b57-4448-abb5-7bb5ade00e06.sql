-- Cron job للإشعارات (كل دقيقتين)
select cron.schedule(
  'notify-whatsapp-every-2m',
  '*/2 * * * *',
  $$
  select net.http_post(
    url:='https://alkhaznaqdlxygeznapt.supabase.co/functions/v1/notify-whatsapp',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsa2hhem5hcWRseHlnZXpuYXB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MDI1MzAsImV4cCI6MjA3NjA3ODUzMH0.aesgCXo0OpPlj7s-5XQ3x55YwGpVGiWWjCP-9_FkP60"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);