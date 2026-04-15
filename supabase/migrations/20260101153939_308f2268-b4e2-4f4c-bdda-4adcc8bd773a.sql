-- Add RLS policy for users to SELECT their own applications
CREATE POLICY "applications_select_own"
ON public.applications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Add RLS policy for users to UPDATE their own applications
CREATE POLICY "applications_update_own"
ON public.applications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add RLS policy for users to INSERT their own applications
CREATE POLICY "applications_insert_own"
ON public.applications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users should NOT be able to delete applications (only admins can)
-- This is already handled by app_admin_all policy