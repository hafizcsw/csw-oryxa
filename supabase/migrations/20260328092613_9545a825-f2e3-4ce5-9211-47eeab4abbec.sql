
-- Fix 1: Remove public read on phone_identities
DROP POLICY IF EXISTS "pi_select_all" ON public.phone_identities;

-- Fix 2: Remove public read/write on harvest_results
DROP POLICY IF EXISTS "harvest_results_read" ON public.harvest_results;
DROP POLICY IF EXISTS "harvest_results_write" ON public.harvest_results;

-- Fix 3: Remove public read on events
DROP POLICY IF EXISTS "ev_select_all" ON public.events;
