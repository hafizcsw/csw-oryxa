-- ============================================
-- WEB CLOSE-LOOP V1: Temporary Outbox Tables
-- ============================================

-- 1.1 Portal Applications (temporary queue)
CREATE TABLE IF NOT EXISTS public.portal_applications_v1 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL REFERENCES auth.users(id),
  program_id uuid NOT NULL,
  program_name text,
  university_name text,
  country_code text,
  status text NOT NULL DEFAULT 'pending_payment', -- pending_payment|submitted|active|cancelled
  services_json jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{service_code, qty, name, unit_price, line_total}]
  total_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  payment_id uuid, -- will be set after payment record created
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.portal_applications_v1 ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "portal_applications_v1_select_own"
ON public.portal_applications_v1 FOR SELECT
USING (auth.uid() = auth_user_id);

CREATE POLICY "portal_applications_v1_insert_own"
ON public.portal_applications_v1 FOR INSERT
WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "portal_applications_v1_update_own"
ON public.portal_applications_v1 FOR UPDATE
USING (auth.uid() = auth_user_id)
WITH CHECK (auth.uid() = auth_user_id);

-- 1.2 Portal Payments (temporary queue)
CREATE TABLE IF NOT EXISTS public.portal_payments_v1 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL REFERENCES auth.users(id),
  application_id uuid NOT NULL REFERENCES public.portal_applications_v1(id) ON DELETE CASCADE,
  amount_required numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'requested', -- requested|proof_received|proof_rejected|fully_paid
  evidence_storage_bucket text,
  evidence_storage_path text,
  rejection_reason text,
  rejected_at timestamptz,
  receipt_no text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.portal_payments_v1 ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "portal_payments_v1_select_own"
ON public.portal_payments_v1 FOR SELECT
USING (auth.uid() = auth_user_id);

CREATE POLICY "portal_payments_v1_insert_own"
ON public.portal_payments_v1 FOR INSERT
WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "portal_payments_v1_update_own"
ON public.portal_payments_v1 FOR UPDATE
USING (auth.uid() = auth_user_id)
WITH CHECK (auth.uid() = auth_user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_portal_apps_v1_user ON public.portal_applications_v1(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_portal_payments_v1_user ON public.portal_payments_v1(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_portal_payments_v1_app ON public.portal_payments_v1(application_id);