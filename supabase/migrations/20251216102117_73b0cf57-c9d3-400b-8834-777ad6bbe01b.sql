-- Fix view security - use SECURITY INVOKER so RLS applies
DROP VIEW IF EXISTS public.vw_portal_applications_v1;

CREATE VIEW public.vw_portal_applications_v1 
WITH (security_invoker = true)
AS
SELECT
  a.*,
  p.status AS payment_status,
  p.rejection_reason,
  p.rejected_at,
  p.evidence_storage_bucket,
  p.evidence_storage_path
FROM public.portal_applications_v1 a
LEFT JOIN public.portal_payments_v1 p ON p.id = a.payment_id;