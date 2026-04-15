-- Replay-safe neutralization:
-- Original migration executed one-off publish proof logic against program_draft id=774.
-- This is intentionally skipped during schema replay to a fresh target environment.

DO $mig$
BEGIN
  RAISE NOTICE 'Skipping one-off proof migration for program_draft id=774 during replay';
END
$mig$;