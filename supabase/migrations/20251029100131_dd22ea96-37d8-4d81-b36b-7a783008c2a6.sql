-- Add sandbox customer support
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_sandbox BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sandbox_owner UUID NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_sandbox ON public.profiles(is_sandbox, sandbox_owner);

-- Function to get or create sandbox customer for staff
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

  -- Get staff email
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
      'طالب تجريبي',
      'preview+'||uid::text||'@example.com',
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