-- Add RLS policies for phone_identities table
-- Users can only see their own phone identity
CREATE POLICY "phone_identities_select_own"
ON public.phone_identities
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own phone identity
CREATE POLICY "phone_identities_insert_own"
ON public.phone_identities
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own phone identity
CREATE POLICY "phone_identities_update_own"
ON public.phone_identities
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins can view all phone identities
CREATE POLICY "phone_identities_admin_select"
ON public.phone_identities
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));