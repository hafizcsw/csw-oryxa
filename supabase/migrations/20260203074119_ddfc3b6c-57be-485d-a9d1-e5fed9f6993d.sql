-- ============================================
-- FIX: QUOTE ENGINE - Pricing Rules Table + Corrected Formula
-- ============================================

-- 1. Create pricing rules table
CREATE TABLE IF NOT EXISTS public.notarized_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_slot TEXT NOT NULL UNIQUE,
  currency TEXT NOT NULL DEFAULT 'USD',
  base_fee INTEGER NOT NULL DEFAULT 1500, -- في السنتات (first page included)
  extra_page_fee INTEGER NOT NULL DEFAULT 500, -- للصفحات الإضافية
  complexity_surcharge INTEGER NOT NULL DEFAULT 0, -- رسوم إضافية للمستندات المعقدة
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Seed default pricing rules
INSERT INTO public.notarized_pricing_rules (doc_slot, base_fee, extra_page_fee, complexity_surcharge) VALUES
  ('passport', 1500, 500, 0),
  ('passport_ru', 1500, 500, 0),
  ('residence', 1500, 500, 0),
  ('residence_ru', 1800, 500, 0),
  ('certificate', 2000, 500, 200),
  ('certificate_ru', 2000, 500, 200),
  ('transcript', 2500, 600, 300),
  ('transcript_ru', 2500, 600, 300),
  ('birth_certificate', 1500, 500, 0),
  ('birth_certificate_ru', 1500, 500, 0),
  ('diploma', 2000, 500, 200),
  ('diploma_ru', 2000, 500, 200),
  ('medical', 1800, 500, 100),
  ('medical_ru', 1800, 500, 100)
ON CONFLICT (doc_slot) DO UPDATE SET
  base_fee = EXCLUDED.base_fee,
  extra_page_fee = EXCLUDED.extra_page_fee,
  updated_at = NOW();

-- 3. RLS for pricing rules (public read)
ALTER TABLE public.notarized_pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pricing rules are public" ON public.notarized_pricing_rules
  FOR SELECT USING (true);

-- 4. Trigger for updated_at
CREATE TRIGGER update_notarized_pricing_rules_updated_at
  BEFORE UPDATE ON public.notarized_pricing_rules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. FIXED Quote calculation function - base includes first page!
CREATE OR REPLACE FUNCTION public.rpc_notarized_quote_create(
  p_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_job RECORD;
  v_pricing RECORD;
  v_breakdown JSONB := '[]'::JSONB;
  v_total INTEGER := 0;
  v_base_fee INTEGER;
  v_extra_pages INTEGER;
  v_extra_pages_fee INTEGER;
  v_line_total INTEGER;
  v_quote_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_currency TEXT := 'USD';
BEGIN
  -- Get order
  SELECT * INTO v_order FROM notarized_translation_orders WHERE id = p_order_id;
  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  
  -- Check order status allows quote creation
  IF v_order.status NOT IN ('awaiting_quote') THEN
    RAISE EXCEPTION 'Order is not ready for quote (current: %)', v_order.status;
  END IF;
  
  -- Check all jobs passed precheck and are awaiting quote
  IF EXISTS (
    SELECT 1 FROM notarized_translation_jobs 
    WHERE order_id = p_order_id 
    AND status NOT IN ('awaiting_quote', 'awaiting_payment', 'paid')
  ) THEN
    RAISE EXCEPTION 'Not all jobs are ready for quote';
  END IF;
  
  -- Expire any existing presented quotes for this order
  UPDATE notarized_translation_quotes
  SET status = 'expired', updated_at = NOW()
  WHERE order_id = p_order_id AND status = 'presented';
  
  -- Calculate breakdown with CORRECT formula: base covers first page
  FOR v_job IN 
    SELECT * FROM notarized_translation_jobs WHERE order_id = p_order_id
  LOOP
    -- Get pricing from rules table
    SELECT * INTO v_pricing FROM notarized_pricing_rules 
    WHERE doc_slot = v_job.doc_slot AND is_active = true;
    
    -- Fallback to defaults if not found
    v_base_fee := COALESCE(v_pricing.base_fee, 1500);
    v_currency := COALESCE(v_pricing.currency, 'USD');
    
    -- CORRECT FORMULA: base_fee includes first page, extra pages are additional
    v_extra_pages := GREATEST(COALESCE(v_job.page_count, 1) - 1, 0);
    v_extra_pages_fee := v_extra_pages * COALESCE(v_pricing.extra_page_fee, 500);
    v_line_total := v_base_fee + v_extra_pages_fee + COALESCE(v_pricing.complexity_surcharge, 0);
    
    v_breakdown := v_breakdown || jsonb_build_object(
      'job_id', v_job.id,
      'doc_slot', v_job.doc_slot,
      'page_count', COALESCE(v_job.page_count, 1),
      'base_fee', v_base_fee,
      'extra_pages', v_extra_pages,
      'extra_pages_fee', v_extra_pages_fee,
      'complexity_surcharge', COALESCE(v_pricing.complexity_surcharge, 0),
      'line_total', v_line_total
    );
    
    v_total := v_total + v_line_total;
  END LOOP;
  
  v_expires_at := NOW() + INTERVAL '24 hours';
  
  -- Create NEW quote row (no ON CONFLICT tricks)
  INSERT INTO notarized_translation_quotes (
    order_id, currency, total_amount, breakdown_json, expires_at, status
  )
  VALUES (
    p_order_id, v_currency, v_total, v_breakdown, v_expires_at, 'presented'
  )
  RETURNING id INTO v_quote_id;
  
  -- Update order status
  UPDATE notarized_translation_orders 
  SET status = 'quote_presented', updated_at = NOW()
  WHERE id = p_order_id;
  
  -- Log event
  INSERT INTO notarized_translation_events (order_id, event_type, new_status, actor_type, meta)
  VALUES (p_order_id, 'quote_created', 'quote_presented', 'system', 
    jsonb_build_object('quote_id', v_quote_id, 'total', v_total, 'breakdown', v_breakdown));
  
  RETURN jsonb_build_object(
    'quote_id', v_quote_id,
    'currency', v_currency,
    'total_amount', v_total,
    'breakdown', v_breakdown,
    'expires_at', v_expires_at
  );
END;
$$;

-- 6. Create canonical wrapper for naming consistency
CREATE OR REPLACE FUNCTION public.rpc_notarized_quote_create(
  p_order_id UUID
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.rpc_translation_quote_create(p_order_id);
$$;

-- Wait, we already replaced rpc_translation_quote_create above. Let's add wrappers:

-- 7. Canonical naming wrappers
CREATE OR REPLACE FUNCTION public.rpc_notarized_quote_accept(
  p_quote_id UUID
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.rpc_translation_quote_accept(p_quote_id);
$$;

CREATE OR REPLACE FUNCTION public.rpc_notarized_quote_get(
  p_order_id UUID
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.rpc_translation_quote_get(p_order_id);
$$;

-- 8. Update rpc_translation_quote_create to use corrected logic
DROP FUNCTION IF EXISTS public.rpc_translation_quote_create(UUID);

CREATE OR REPLACE FUNCTION public.rpc_translation_quote_create(
  p_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_job RECORD;
  v_pricing RECORD;
  v_breakdown JSONB := '[]'::JSONB;
  v_total INTEGER := 0;
  v_base_fee INTEGER;
  v_extra_pages INTEGER;
  v_extra_pages_fee INTEGER;
  v_line_total INTEGER;
  v_quote_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_currency TEXT := 'USD';
BEGIN
  -- Get order
  SELECT * INTO v_order FROM notarized_translation_orders WHERE id = p_order_id;
  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  
  -- Check order status allows quote creation
  IF v_order.status NOT IN ('awaiting_quote') THEN
    RAISE EXCEPTION 'Order is not ready for quote (current: %)', v_order.status;
  END IF;
  
  -- Check all jobs passed precheck and are awaiting quote
  IF EXISTS (
    SELECT 1 FROM notarized_translation_jobs 
    WHERE order_id = p_order_id 
    AND status NOT IN ('awaiting_quote', 'awaiting_payment', 'paid')
  ) THEN
    RAISE EXCEPTION 'Not all jobs are ready for quote';
  END IF;
  
  -- Expire any existing presented quotes for this order
  UPDATE notarized_translation_quotes
  SET status = 'expired', updated_at = NOW()
  WHERE order_id = p_order_id AND status = 'presented';
  
  -- Calculate breakdown with CORRECT formula: base covers first page
  FOR v_job IN 
    SELECT * FROM notarized_translation_jobs WHERE order_id = p_order_id
  LOOP
    -- Get pricing from rules table
    SELECT * INTO v_pricing FROM notarized_pricing_rules 
    WHERE doc_slot = v_job.doc_slot AND is_active = true;
    
    -- Fallback to defaults if not found
    v_base_fee := COALESCE(v_pricing.base_fee, 1500);
    v_currency := COALESCE(v_pricing.currency, 'USD');
    
    -- CORRECT FORMULA: base_fee includes first page, extra pages are additional
    v_extra_pages := GREATEST(COALESCE(v_job.page_count, 1) - 1, 0);
    v_extra_pages_fee := v_extra_pages * COALESCE(v_pricing.extra_page_fee, 500);
    v_line_total := v_base_fee + v_extra_pages_fee + COALESCE(v_pricing.complexity_surcharge, 0);
    
    v_breakdown := v_breakdown || jsonb_build_object(
      'job_id', v_job.id,
      'doc_slot', v_job.doc_slot,
      'page_count', COALESCE(v_job.page_count, 1),
      'base_fee', v_base_fee,
      'extra_pages', v_extra_pages,
      'extra_pages_fee', v_extra_pages_fee,
      'complexity_surcharge', COALESCE(v_pricing.complexity_surcharge, 0),
      'line_total', v_line_total
    );
    
    v_total := v_total + v_line_total;
  END LOOP;
  
  v_expires_at := NOW() + INTERVAL '24 hours';
  
  -- Create NEW quote row (no ON CONFLICT tricks)
  INSERT INTO notarized_translation_quotes (
    order_id, currency, total_amount, breakdown_json, expires_at, status
  )
  VALUES (
    p_order_id, v_currency, v_total, v_breakdown, v_expires_at, 'presented'
  )
  RETURNING id INTO v_quote_id;
  
  -- Update order status
  UPDATE notarized_translation_orders 
  SET status = 'quote_presented', updated_at = NOW()
  WHERE id = p_order_id;
  
  -- Log event
  INSERT INTO notarized_translation_events (order_id, event_type, new_status, actor_type, meta)
  VALUES (p_order_id, 'quote_created', 'quote_presented', 'system', 
    jsonb_build_object('quote_id', v_quote_id, 'total', v_total, 'breakdown', v_breakdown));
  
  RETURN jsonb_build_object(
    'quote_id', v_quote_id,
    'currency', v_currency,
    'total_amount', v_total,
    'breakdown', v_breakdown,
    'expires_at', v_expires_at
  );
END;
$$;