-- Ensure expires_at has a proper default value
ALTER TABLE public.hmac_nonces
ALTER COLUMN expires_at SET DEFAULT (now() + interval '10 minutes');

-- Also ensure used_at has default if missing
ALTER TABLE public.hmac_nonces
ALTER COLUMN used_at SET DEFAULT now();