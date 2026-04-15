-- RPC للربط التلقائي بين Auth و Customer
CREATE OR REPLACE FUNCTION public.rpc_link_my_auth()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  uemail text;
  prof_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  
  SELECT email INTO uemail FROM auth.users WHERE id = uid;
  IF uemail IS NULL THEN RAISE EXCEPTION 'Auth user has no email'; END IF;

  -- ربط بالبروفايل الموجود
  UPDATE public.profiles
    SET user_id = uid, updated_at = now()
  WHERE user_id IS NULL AND lower(email) = lower(uemail)
  RETURNING user_id INTO prof_id;

  IF prof_id IS NULL THEN
    SELECT user_id INTO prof_id FROM public.profiles WHERE user_id = uid;
  END IF;

  IF prof_id IS NULL THEN RAISE EXCEPTION 'No matching profile for this auth user'; END IF;
  RETURN prof_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.rpc_link_my_auth() TO authenticated;

-- RPC لتحديث البروفايل
CREATE OR REPLACE FUNCTION public.rpc_student_update_profile(
  p_full_name text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_national_id text DEFAULT NULL,
  p_address_city text DEFAULT NULL,
  p_address_country text DEFAULT NULL,
  p_emergency_name text DEFAULT NULL,
  p_emergency_phone text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  UPDATE public.profiles
  SET 
    full_name = COALESCE(p_full_name, full_name),
    email = COALESCE(p_email, email),
    phone = COALESCE(p_phone, phone),
    national_id = COALESCE(p_national_id, national_id),
    city = COALESCE(p_address_city, city),
    country = COALESCE(p_address_country, country),
    emergency_contact_name = COALESCE(p_emergency_name, emergency_contact_name),
    emergency_contact_phone = COALESCE(p_emergency_phone, emergency_contact_phone),
    updated_at = now()
  WHERE user_id = uid;
END; $$;

GRANT EXECUTE ON FUNCTION public.rpc_student_update_profile TO authenticated;

-- إضافة أعمدة جديدة إذا لم تكن موجودة
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS national_id text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS avatar_storage_path text;

-- جدول الملفات
CREATE TABLE IF NOT EXISTS public.customer_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  storage_path text NOT NULL,
  file_type text,
  file_size bigint,
  uploaded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- RLS للملفات
ALTER TABLE public.customer_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own files"
ON public.customer_files FOR SELECT
USING (auth.uid() = profile_id);

CREATE POLICY "Users can upload their own files"
ON public.customer_files FOR INSERT
WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can delete their own files"
ON public.customer_files FOR DELETE
USING (auth.uid() = profile_id);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-docs', 'student-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload to their own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'student-docs' AND
  auth.uid()::text = (storage.foldername(name))[2]
);

CREATE POLICY "Users can view their own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'student-docs' AND
  auth.uid()::text = (storage.foldername(name))[2]
);

CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'student-docs' AND
  auth.uid()::text = (storage.foldername(name))[2]
);