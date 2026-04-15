
-- Fix the check constraint to include all statuses used by the code
ALTER TABLE uniranks_step_runs DROP CONSTRAINT IF EXISTS uniranks_step_runs_status_check;
ALTER TABLE uniranks_step_runs ADD CONSTRAINT uniranks_step_runs_status_check 
  CHECK (status = ANY (ARRAY[
    'pending'::text, 'ok'::text, 'not_present'::text, 'js_required'::text, 
    'fetch_error'::text, 'parse_error'::text, 'skipped'::text, 'excluded'::text,
    'timeout'::text, 'rate_limited'::text, 'error'::text
  ]));
