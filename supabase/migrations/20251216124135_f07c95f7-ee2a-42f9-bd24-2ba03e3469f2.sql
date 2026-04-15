-- 1) Online payment tracking columns
ALTER TABLE public.portal_payments_v1
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_session_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- 2) Receipt number auto-gen sequence
CREATE SEQUENCE IF NOT EXISTS public.portal_receipt_no_seq;

-- 3) Trigger function for receipt_no auto-generation
CREATE OR REPLACE FUNCTION public.tg_portal_payments_set_receipt_no()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'fully_paid' AND (NEW.receipt_no IS NULL OR NEW.receipt_no = '') THEN
    NEW.receipt_no :=
      'CSW-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.portal_receipt_no_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

-- 4) Drop existing trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_portal_payments_set_receipt_no ON public.portal_payments_v1;

CREATE TRIGGER trg_portal_payments_set_receipt_no
BEFORE UPDATE OF status ON public.portal_payments_v1
FOR EACH ROW
EXECUTE FUNCTION public.tg_portal_payments_set_receipt_no();