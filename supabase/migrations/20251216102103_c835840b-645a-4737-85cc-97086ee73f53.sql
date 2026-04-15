-- 1) portal_applications_v1: add snapshot fields
ALTER TABLE public.portal_applications_v1
  ADD COLUMN IF NOT EXISTS program_name text,
  ADD COLUMN IF NOT EXISTS university_name text;

-- 2) portal_payments_v1: add updated_at
ALTER TABLE public.portal_payments_v1
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 3) portal_applications_v1: add updated_at if missing
ALTER TABLE public.portal_applications_v1
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 4) Create triggers for auto-updating updated_at
DROP TRIGGER IF EXISTS trg_portal_applications_v1_updated_at ON public.portal_applications_v1;
CREATE TRIGGER trg_portal_applications_v1_updated_at
BEFORE UPDATE ON public.portal_applications_v1
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_portal_payments_v1_updated_at ON public.portal_payments_v1;
CREATE TRIGGER trg_portal_payments_v1_updated_at
BEFORE UPDATE ON public.portal_payments_v1
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) Create view to join apps with payment status
CREATE OR REPLACE VIEW public.vw_portal_applications_v1 AS
SELECT
  a.*,
  p.status AS payment_status,
  p.rejection_reason,
  p.rejected_at,
  p.evidence_storage_bucket,
  p.evidence_storage_path
FROM public.portal_applications_v1 a
LEFT JOIN public.portal_payments_v1 p ON p.id = a.payment_id;