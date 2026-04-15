-- Replay-safe neutralization:
-- Original migration scheduled an environment-specific pg_cron job
-- targeting an old project runtime. This is intentionally skipped during
-- schema replay to a fresh target environment.

DO $mig$
BEGIN
  RAISE NOTICE 'Skipping environment-specific cron.schedule(city-backfill-turbo) migration during replay';
END
$mig$;