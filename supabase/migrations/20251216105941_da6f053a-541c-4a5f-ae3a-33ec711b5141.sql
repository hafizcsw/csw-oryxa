-- Drop and recreate VIEW with receipt_no
DROP VIEW IF EXISTS public.vw_portal_applications_v1;

CREATE VIEW public.vw_portal_applications_v1 
WITH (security_invoker = on) AS
SELECT
  a.id,
  a.auth_user_id,
  a.program_id,
  a.program_name,
  a.university_name,
  a.country_code,
  a.status,
  a.services_json,
  a.total_amount,
  a.currency,
  a.payment_id,
  a.created_at,
  a.updated_at,
  p.status AS payment_status,
  p.rejection_reason,
  p.rejected_at,
  p.receipt_no,
  p.evidence_storage_bucket,
  p.evidence_storage_path
FROM public.portal_applications_v1 a
LEFT JOIN public.portal_payments_v1 p ON p.id = a.payment_id;