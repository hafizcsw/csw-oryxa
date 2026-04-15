-- Replay-safe neutralization:
-- Original migration altered an environment-specific pg_cron job (jobid=20)
-- and referenced an old project runtime. This is intentionally skipped during
-- schema replay to a fresh target environment.

DO $mig$
BEGIN
  RAISE NOTICE 'Skipping environment-specific cron.alter_job(20) migration during replay';
END
$mig$;
