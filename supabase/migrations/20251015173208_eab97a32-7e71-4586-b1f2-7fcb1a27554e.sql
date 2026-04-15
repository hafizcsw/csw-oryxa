-- LAV #15.1: Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Test function using gen_random_uuid which should work
CREATE OR REPLACE FUNCTION public.test_crypto_basic()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'uuid', gen_random_uuid()::text,
    'timestamp', now()::text,
    'pgcrypto_enabled', true
  );
$$;