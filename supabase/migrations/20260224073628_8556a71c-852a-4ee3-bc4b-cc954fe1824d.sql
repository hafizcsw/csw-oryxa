-- FIX #4: Create a thin SQL wrapper for pg_try_advisory_xact_lock
-- so it can be called via supabase.rpc()
CREATE OR REPLACE FUNCTION public.pg_try_advisory_xact_lock(lock_id int)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pg_try_advisory_xact_lock(lock_id);
$$;