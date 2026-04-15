-- FIX: Add 'fetching' to program_urls status CHECK constraint
-- rpc_reset_stuck_locks writes WHERE status IN ('fetching', 'extracting')
-- but 'fetching' was missing from the allowed values
ALTER TABLE public.program_urls DROP CONSTRAINT IF EXISTS program_urls_status_check;
ALTER TABLE public.program_urls ADD CONSTRAINT program_urls_status_check
  CHECK (status IN ('pending', 'fetching', 'fetched', 'failed', 'skipped', 'retry', 'extracting', 'extracted', 'done'));