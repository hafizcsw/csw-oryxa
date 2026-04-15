-- Order 3.3: Fix infinite recursion in user_roles RLS policy

-- 1) Create SECURITY DEFINER function to check admin without triggering RLS
CREATE OR REPLACE FUNCTION public.check_is_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = check_user_id AND role = 'admin'
  );
$$;

-- 2) Drop the problematic policy causing infinite recursion
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

-- 3) Recreate policy using the SECURITY DEFINER function
CREATE POLICY "Admins can manage all roles" ON public.user_roles
FOR ALL
TO authenticated
USING (public.check_is_admin(auth.uid()))
WITH CHECK (public.check_is_admin(auth.uid()));