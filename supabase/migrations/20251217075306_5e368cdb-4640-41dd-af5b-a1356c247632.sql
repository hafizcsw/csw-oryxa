
-- =========================================================
-- Case Dashboard V1 - Complete Student Case Management
-- =========================================================

-- =========================================================
-- 1) Student Case Timeline / Events
-- =========================================================
CREATE TABLE IF NOT EXISTS public.student_case_events_v1 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  application_id uuid NULL,
  event_type text NOT NULL,
  title text NOT NULL,
  description text NULL,
  status text NOT NULL DEFAULT 'open',
  due_at timestamptz NULL,
  created_by_staff_user_id uuid NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_events_user_created_at
  ON public.student_case_events_v1(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_case_events_app_created_at
  ON public.student_case_events_v1(application_id, created_at DESC);

ALTER TABLE public.student_case_events_v1 ENABLE ROW LEVEL SECURITY;

CREATE POLICY student_can_read_case_events_v1
  ON public.student_case_events_v1
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- =========================================================
-- 2) Service Jobs (Timed Tasks - Translation, Visa, etc.)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.student_service_jobs_v1 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  application_id uuid NULL,
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  due_at timestamptz NULL,
  completed_at timestamptz NULL,
  delivery_option text NULL,
  delivery_address jsonb NULL,
  price_extra numeric NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_jobs_user_due
  ON public.student_service_jobs_v1(user_id, due_at);

CREATE INDEX IF NOT EXISTS idx_service_jobs_app_due
  ON public.student_service_jobs_v1(application_id, due_at);

ALTER TABLE public.student_service_jobs_v1 ENABLE ROW LEVEL SECURITY;

CREATE POLICY student_can_read_service_jobs_v1
  ON public.student_service_jobs_v1
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- =========================================================
-- 3) Student Contracts
-- =========================================================
CREATE TABLE IF NOT EXISTS public.student_contracts_v1 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  application_id uuid NULL,
  template_key text NOT NULL,
  status text NOT NULL DEFAULT 'ready',
  contract_file_id uuid NULL,
  signed_contract_file_id uuid NULL,
  consent_version text NULL,
  signed_by_auth_user_id uuid NULL,
  signed_at timestamptz NULL,
  signed_ip text NULL,
  signed_user_agent text NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_contracts_user_app_template
  ON public.student_contracts_v1(user_id, application_id, template_key);

ALTER TABLE public.student_contracts_v1 ENABLE ROW LEVEL SECURITY;

CREATE POLICY student_can_read_contracts_v1
  ON public.student_contracts_v1
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- =========================================================
-- 4) Delivery Requests
-- =========================================================
CREATE TABLE IF NOT EXISTS public.student_delivery_requests_v1 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  application_id uuid NULL,
  delivery_type text NOT NULL,
  address jsonb NOT NULL,
  status text NOT NULL DEFAULT 'requested',
  shipping_fee_payment_id uuid NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_user_created
  ON public.student_delivery_requests_v1(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_app_created
  ON public.student_delivery_requests_v1(application_id, created_at DESC);

ALTER TABLE public.student_delivery_requests_v1 ENABLE ROW LEVEL SECURITY;

CREATE POLICY student_can_read_delivery_v1
  ON public.student_delivery_requests_v1
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY student_can_insert_delivery_v1
  ON public.student_delivery_requests_v1
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- 5) Case Admin Audit Log
-- =========================================================
CREATE TABLE IF NOT EXISTS public.student_admin_audit_log_v1 (
  id bigserial PRIMARY KEY,
  staff_auth_user_id uuid NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NULL,
  old_data jsonb NULL,
  new_data jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_admin_audit_log_v1 ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_can_read_audit_log_v1
  ON public.student_admin_audit_log_v1
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- =========================================================
-- 6) Updated_at trigger for delivery requests
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_student_delivery_requests_v1_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_student_delivery_requests_v1_updated_at ON public.student_delivery_requests_v1;
CREATE TRIGGER trg_student_delivery_requests_v1_updated_at
  BEFORE UPDATE ON public.student_delivery_requests_v1
  FOR EACH ROW
  EXECUTE FUNCTION public.update_student_delivery_requests_v1_updated_at();
