-- إصلاح RPC function لدعم تحديث الصورة الشخصية
CREATE OR REPLACE FUNCTION public.rpc_student_update_profile(
  p_full_name text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_national_id text DEFAULT NULL,
  p_address_city text DEFAULT NULL,
  p_address_country text DEFAULT NULL,
  p_emergency_name text DEFAULT NULL,
  p_emergency_phone text DEFAULT NULL,
  p_avatar_path text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    avatar_storage_path = COALESCE(p_avatar_path, avatar_storage_path),
    updated_at = now()
  WHERE user_id = uid;
END;
$$;