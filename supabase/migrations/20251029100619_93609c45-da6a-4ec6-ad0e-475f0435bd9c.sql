-- Fix portal_tokens RLS policies
ALTER TABLE public.portal_tokens ENABLE ROW LEVEL SECURITY;

-- Allow service role and admins to manage tokens
CREATE POLICY "portal_tokens_admin_all"
ON public.portal_tokens
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Allow function to insert tokens (for preview)
CREATE POLICY "portal_tokens_system_insert"
ON public.portal_tokens
FOR INSERT
WITH CHECK (true);

-- RLS for sandbox profiles
CREATE POLICY "sandbox_profiles_owner_access"
ON public.profiles
FOR ALL
USING (
  CASE 
    WHEN is_sandbox = true AND sandbox_owner IS NOT NULL 
    THEN auth.uid() = sandbox_owner OR is_admin(auth.uid())
    ELSE auth.uid() = user_id OR is_admin(auth.uid())
  END
)
WITH CHECK (
  CASE 
    WHEN is_sandbox = true AND sandbox_owner IS NOT NULL 
    THEN auth.uid() = sandbox_owner OR is_admin(auth.uid())
    ELSE auth.uid() = user_id OR is_admin(auth.uid())
  END
);

-- Update rpc function to check admin status
CREATE OR REPLACE FUNCTION public.rpc_get_or_create_sandbox_customer_for_staff()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  sid UUID;
  semail TEXT;
BEGIN
  IF uid IS NULL THEN 
    RAISE EXCEPTION 'Not authenticated'; 
  END IF;

  -- Check if user is admin
  IF NOT is_admin(uid) THEN
    RAISE EXCEPTION 'Not authorized - admin access required';
  END IF;

  -- Get admin email
  SELECT email INTO semail FROM auth.users WHERE id = uid;
  IF semail IS NULL THEN
    RAISE EXCEPTION 'User email not found';
  END IF;

  -- Check if sandbox already exists
  SELECT user_id INTO sid 
  FROM public.profiles
  WHERE is_sandbox = true AND sandbox_owner = uid
  LIMIT 1;

  IF sid IS NULL THEN
    -- Create sandbox profile
    INSERT INTO public.profiles (
      user_id, 
      full_name, 
      email, 
      phone, 
      is_sandbox, 
      sandbox_owner,
      student_substage,
      student_progress,
      created_at
    )
    VALUES (
      gen_random_uuid(),
      'طالب تجريبي - ' || COALESCE((SELECT email FROM auth.users WHERE id = uid), 'مجهول'),
      'sandbox.'||uid::text||'@preview.local',
      NULL,
      true,
      uid,
      'collecting_docs',
      15,
      NOW()
    )
    RETURNING user_id INTO sid;
  END IF;

  RETURN sid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_or_create_sandbox_customer_for_staff() TO authenticated;