-- WEB Close-Loop V1 FINAL Migration

-- 1) payments columns (if missing)
ALTER TABLE public.portal_payments_v1
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS evidence_storage_bucket text,
  ADD COLUMN IF NOT EXISTS evidence_storage_path text,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS receipt_no text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2) applications columns (if missing)
ALTER TABLE public.portal_applications_v1
  ADD COLUMN IF NOT EXISTS program_name text,
  ADD COLUMN IF NOT EXISTS university_name text,
  ADD COLUMN IF NOT EXISTS payment_id uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 3) updated_at triggers
DROP TRIGGER IF EXISTS trg_portal_payments_v1_updated_at ON public.portal_payments_v1;
CREATE TRIGGER trg_portal_payments_v1_updated_at
BEFORE UPDATE ON public.portal_payments_v1
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_portal_applications_v1_updated_at ON public.portal_applications_v1;
CREATE TRIGGER trg_portal_applications_v1_updated_at
BEFORE UPDATE ON public.portal_applications_v1
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) VIEW: applications + joined payment status/rejection/receipt/evidence
DROP VIEW IF EXISTS public.vw_portal_applications_v1;
CREATE VIEW public.vw_portal_applications_v1 AS
SELECT
  a.*,
  p.status as payment_status,
  p.rejection_reason,
  p.rejected_at,
  p.receipt_no,
  p.evidence_storage_bucket,
  p.evidence_storage_path
FROM public.portal_applications_v1 a
LEFT JOIN public.portal_payments_v1 p
  ON p.id = a.payment_id
 AND p.auth_user_id = a.auth_user_id;

-- 5) indexes
CREATE INDEX IF NOT EXISTS idx_portal_apps_user_created
  ON public.portal_applications_v1 (auth_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portal_pays_user_created
  ON public.portal_payments_v1 (auth_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portal_pays_app
  ON public.portal_payments_v1 (application_id);

-- 6) RLS policies
ALTER TABLE public.portal_applications_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_payments_v1 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal_apps_own_select" ON public.portal_applications_v1;
CREATE POLICY "portal_apps_own_select"
ON public.portal_applications_v1 FOR SELECT
USING (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "portal_apps_own_insert" ON public.portal_applications_v1;
CREATE POLICY "portal_apps_own_insert"
ON public.portal_applications_v1 FOR INSERT
WITH CHECK (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "portal_pays_own_select" ON public.portal_payments_v1;
CREATE POLICY "portal_pays_own_select"
ON public.portal_payments_v1 FOR SELECT
USING (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "portal_pays_own_update" ON public.portal_payments_v1;
CREATE POLICY "portal_pays_own_update"
ON public.portal_payments_v1 FOR UPDATE
USING (auth.uid() = auth_user_id);