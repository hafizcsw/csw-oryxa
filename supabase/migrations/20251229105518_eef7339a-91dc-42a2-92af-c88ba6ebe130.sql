-- =============================================
-- FIX: Profiles table RLS - Restrict to authenticated users only
-- =============================================

-- Drop existing policies that use 'public' role
DROP POLICY IF EXISTS "profiles_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_ins" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_upd" ON public.profiles;
DROP POLICY IF EXISTS "sandbox_profiles_owner_access" ON public.profiles;

-- Create stricter policies that only allow authenticated users
-- Policy 1: Users can only SELECT their own profile
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy 2: Users can only INSERT their own profile
CREATE POLICY "profiles_insert_own"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can only UPDATE their own profile
CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 4: Users can only DELETE their own profile
CREATE POLICY "profiles_delete_own"
ON public.profiles
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Policy 5: Admins can access all profiles (using existing is_admin function)
CREATE POLICY "profiles_admin_all"
ON public.profiles
FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Policy 6: Handle sandbox profiles (for demo/testing purposes)
CREATE POLICY "profiles_sandbox_owner"
ON public.profiles
FOR ALL
TO authenticated
USING (
  is_sandbox = true 
  AND sandbox_owner IS NOT NULL 
  AND (auth.uid() = sandbox_owner OR is_admin(auth.uid()))
)
WITH CHECK (
  is_sandbox = true 
  AND sandbox_owner IS NOT NULL 
  AND (auth.uid() = sandbox_owner OR is_admin(auth.uid()))
);