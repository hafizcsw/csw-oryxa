-- Enable RLS on harvest_results table
ALTER TABLE public.harvest_results ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies on the table
DROP POLICY IF EXISTS "harvest_results_admin_all" ON public.harvest_results;
DROP POLICY IF EXISTS "harvest_results_select_all" ON public.harvest_results;
DROP POLICY IF EXISTS "harvest_results_insert_all" ON public.harvest_results;
DROP POLICY IF EXISTS "harvest_results_update_all" ON public.harvest_results;
DROP POLICY IF EXISTS "harvest_results_delete_all" ON public.harvest_results;
DROP POLICY IF EXISTS "harvest_results_admin_select" ON public.harvest_results;
DROP POLICY IF EXISTS "harvest_results_admin_insert" ON public.harvest_results;
DROP POLICY IF EXISTS "harvest_results_admin_update" ON public.harvest_results;
DROP POLICY IF EXISTS "harvest_results_admin_delete" ON public.harvest_results;

-- Create admin-only policy for all operations using is_admin(auth.uid())
-- Only admins can SELECT harvest_results
CREATE POLICY "harvest_results_admin_select"
ON public.harvest_results
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- Only admins can INSERT harvest_results
CREATE POLICY "harvest_results_admin_insert"
ON public.harvest_results
FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

-- Only admins can UPDATE harvest_results
CREATE POLICY "harvest_results_admin_update"
ON public.harvest_results
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()));

-- Only admins can DELETE harvest_results
CREATE POLICY "harvest_results_admin_delete"
ON public.harvest_results
FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));