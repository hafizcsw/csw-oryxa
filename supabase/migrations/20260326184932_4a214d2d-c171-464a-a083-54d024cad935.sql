
-- 1. Unique index on profiles.phone (nullable unique — only enforced when phone IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone_unique 
ON public.profiles (phone) WHERE phone IS NOT NULL;

-- 2. Add activation_status column (UI convenience cache only — portal_customer_map remains operational truth)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS 
  activation_status text NOT NULL DEFAULT 'pending';
