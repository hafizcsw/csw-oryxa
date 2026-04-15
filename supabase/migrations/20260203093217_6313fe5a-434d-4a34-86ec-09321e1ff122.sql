
-- ============================================================
-- SPRINT B: Payment MVP + Ledger + Webhook
-- B1: Payment Tables (Complete)
-- ============================================================

-- 0) Create update_updated_at_column function FIRST
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 1) notarized_payments: Main payment records
CREATE TABLE IF NOT EXISTS public.notarized_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.notarized_translation_quotes(id),
  order_id UUID NOT NULL REFERENCES public.notarized_translation_orders(id),
  
  -- Payment details
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RUB',
  
  -- Provider info
  provider TEXT NOT NULL DEFAULT 'stripe',
  provider_payment_id TEXT,
  provider_session_id TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'succeeded', 'failed', 'refunded', 'cancelled'
  )),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  
  -- Idempotency
  idempotency_key TEXT UNIQUE
);

-- 2) payment_provider_events: Webhook event log for idempotency
CREATE TABLE IF NOT EXISTS public.notarized_payment_provider_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES public.notarized_payments(id),
  
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  
  raw_payload JSONB,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_provider_event UNIQUE (provider, provider_event_id)
);

-- 3) notarized_ledger: Simple debit/credit entries
CREATE TABLE IF NOT EXISTS public.notarized_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  order_id UUID REFERENCES public.notarized_translation_orders(id),
  payment_id UUID REFERENCES public.notarized_payments(id),
  quote_id UUID REFERENCES public.notarized_translation_quotes(id),
  
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'charge', 'refund', 'adjustment', 'fee'
  )),
  
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RUB',
  
  debit_account TEXT,
  credit_account TEXT,
  
  description TEXT,
  meta JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) Indexes
CREATE INDEX IF NOT EXISTS idx_payments_quote_id ON public.notarized_payments(quote_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.notarized_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.notarized_payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_provider_id ON public.notarized_payments(provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_ledger_order_id ON public.notarized_ledger(order_id);
CREATE INDEX IF NOT EXISTS idx_ledger_payment_id ON public.notarized_ledger(payment_id);
CREATE INDEX IF NOT EXISTS idx_provider_events_payment ON public.notarized_payment_provider_events(payment_id);

-- 5) Enable RLS
ALTER TABLE public.notarized_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notarized_payment_provider_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notarized_ledger ENABLE ROW LEVEL SECURITY;

-- 6) RLS Policy - Payments visible to order owner
CREATE POLICY "Users can view their payments"
  ON public.notarized_payments
  FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM public.notarized_translation_orders 
      WHERE customer_id = auth.uid()
    )
  );

-- 7) Update trigger for payments
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.notarized_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
