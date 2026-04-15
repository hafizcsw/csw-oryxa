-- ============================================
-- QUOTE ENGINE ADDITIONS
-- ============================================

-- 1. Add translation_quotes table
CREATE TABLE IF NOT EXISTS public.notarized_translation_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.notarized_translation_orders(id) ON DELETE CASCADE,
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'presented', 'accepted', 'expired', 'rejected')),
  
  -- Pricing
  currency TEXT NOT NULL DEFAULT 'USD',
  total_amount INTEGER NOT NULL DEFAULT 0, -- in cents
  breakdown_json JSONB NOT NULL DEFAULT '[]'::JSONB,
  
  -- Validity
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  accepted_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add page_count to jobs
ALTER TABLE public.notarized_translation_jobs 
ADD COLUMN IF NOT EXISTS page_count INTEGER DEFAULT 1;

-- 3. Update order status to include quote states
ALTER TABLE public.notarized_translation_orders 
DROP CONSTRAINT IF EXISTS notarized_translation_orders_status_check;

ALTER TABLE public.notarized_translation_orders 
ADD CONSTRAINT notarized_translation_orders_status_check 
CHECK (status IN (
  'created', 'awaiting_upload', 'awaiting_precheck', 'precheck_rejected',
  'awaiting_quote', 'quote_presented', 'awaiting_payment', 'paid', 
  'processing', 'draft_ready', 'notarized_scan_ready', 'delivered', 'failed', 'purged'
));

-- 4. Update job status to include quote state
ALTER TABLE public.notarized_translation_jobs 
DROP CONSTRAINT IF EXISTS notarized_translation_jobs_status_check;

ALTER TABLE public.notarized_translation_jobs 
ADD CONSTRAINT notarized_translation_jobs_status_check 
CHECK (status IN (
  'awaiting_upload', 'awaiting_precheck', 'precheck_rejected',
  'awaiting_quote', 'awaiting_payment', 'paid', 'processing_ocr', 'processing_extract',
  'processing_translate', 'processing_render', 'draft_ready', 'failed', 'purged'
));

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_notarized_quotes_order ON public.notarized_translation_quotes(order_id);
CREATE INDEX IF NOT EXISTS idx_notarized_quotes_status ON public.notarized_translation_quotes(status);

-- 6. RLS
ALTER TABLE public.notarized_translation_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers view own quotes"
  ON public.notarized_translation_quotes FOR SELECT
  USING (
    order_id IN (SELECT id FROM public.notarized_translation_orders WHERE customer_id = auth.uid())
  );

-- 7. Trigger
CREATE TRIGGER update_notarized_quotes_updated_at
  BEFORE UPDATE ON public.notarized_translation_quotes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- QUOTE ENGINE RPCs
-- ============================================

-- Pricing config (can be made into a table later)
CREATE OR REPLACE FUNCTION public.get_translation_price_config()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT '{
    "base_prices": {
      "passport": 1500,
      "certificate": 2000,
      "transcript": 2500,
      "residence": 1500,
      "birth_certificate": 1500,
      "diploma": 2000,
      "medical": 1800
    },
    "per_page_price": 500,
    "currency": "USD"
  }'::JSONB;
$$;

-- Create quote for order
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
  v_config JSONB;
  v_breakdown JSONB := '[]'::JSONB;
  v_total INTEGER := 0;
  v_base_price INTEGER;
  v_page_price INTEGER;
  v_line_total INTEGER;
  v_quote_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Get order
  SELECT * INTO v_order FROM notarized_translation_orders WHERE id = p_order_id;
  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  
  -- Check all jobs passed precheck
  IF EXISTS (
    SELECT 1 FROM notarized_translation_jobs 
    WHERE order_id = p_order_id 
    AND status NOT IN ('awaiting_quote', 'awaiting_payment', 'paid')
  ) THEN
    RAISE EXCEPTION 'Not all jobs are ready for quote';
  END IF;
  
  -- Get pricing config
  v_config := get_translation_price_config();
  
  -- Calculate breakdown
  FOR v_job IN 
    SELECT * FROM notarized_translation_jobs WHERE order_id = p_order_id
  LOOP
    v_base_price := COALESCE((v_config->'base_prices'->>v_job.doc_slot)::INTEGER, 1500);
    v_page_price := COALESCE(v_job.page_count, 1) * (v_config->>'per_page_price')::INTEGER;
    v_line_total := v_base_price + v_page_price;
    
    v_breakdown := v_breakdown || jsonb_build_object(
      'job_id', v_job.id,
      'doc_slot', v_job.doc_slot,
      'page_count', COALESCE(v_job.page_count, 1),
      'base_price', v_base_price,
      'page_price', v_page_price,
      'line_total', v_line_total
    );
    
    v_total := v_total + v_line_total;
  END LOOP;
  
  v_expires_at := NOW() + INTERVAL '24 hours';
  
  -- Create or update quote
  INSERT INTO notarized_translation_quotes (order_id, currency, total_amount, breakdown_json, expires_at, status)
  VALUES (p_order_id, v_config->>'currency', v_total, v_breakdown, v_expires_at, 'presented')
  ON CONFLICT (order_id) WHERE status = 'pending'
  DO UPDATE SET 
    total_amount = EXCLUDED.total_amount,
    breakdown_json = EXCLUDED.breakdown_json,
    expires_at = EXCLUDED.expires_at,
    status = 'presented',
    updated_at = NOW()
  RETURNING id INTO v_quote_id;
  
  -- Update order status
  UPDATE notarized_translation_orders 
  SET status = 'quote_presented', updated_at = NOW()
  WHERE id = p_order_id;
  
  -- Log event
  INSERT INTO notarized_translation_events (order_id, event_type, new_status, actor_type, meta)
  VALUES (p_order_id, 'quote_created', 'quote_presented', 'system', 
    jsonb_build_object('quote_id', v_quote_id, 'total', v_total));
  
  RETURN jsonb_build_object(
    'quote_id', v_quote_id,
    'currency', v_config->>'currency',
    'total_amount', v_total,
    'breakdown', v_breakdown,
    'expires_at', v_expires_at
  );
END;
$$;

-- Accept quote
CREATE OR REPLACE FUNCTION public.rpc_translation_quote_accept(
  p_quote_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote RECORD;
BEGIN
  SELECT * INTO v_quote FROM notarized_translation_quotes WHERE id = p_quote_id;
  
  IF v_quote IS NULL THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;
  
  IF v_quote.status != 'presented' THEN
    RAISE EXCEPTION 'Quote is not in presented state';
  END IF;
  
  IF v_quote.expires_at < NOW() THEN
    UPDATE notarized_translation_quotes SET status = 'expired' WHERE id = p_quote_id;
    RAISE EXCEPTION 'Quote has expired';
  END IF;
  
  -- Accept quote
  UPDATE notarized_translation_quotes 
  SET status = 'accepted', accepted_at = NOW(), updated_at = NOW()
  WHERE id = p_quote_id;
  
  -- Update order
  UPDATE notarized_translation_orders 
  SET status = 'awaiting_payment', updated_at = NOW()
  WHERE id = v_quote.order_id;
  
  -- Update jobs
  UPDATE notarized_translation_jobs 
  SET status = 'awaiting_payment', updated_at = NOW()
  WHERE order_id = v_quote.order_id AND status = 'awaiting_quote';
  
  -- Log
  INSERT INTO notarized_translation_events (order_id, event_type, new_status, actor_type, meta)
  VALUES (v_quote.order_id, 'quote_accepted', 'awaiting_payment', 'customer', 
    jsonb_build_object('quote_id', p_quote_id, 'total', v_quote.total_amount));
  
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Get quote for order
CREATE OR REPLACE FUNCTION public.rpc_translation_quote_get(
  p_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote RECORD;
BEGIN
  SELECT * INTO v_quote 
  FROM notarized_translation_quotes 
  WHERE order_id = p_order_id 
  ORDER BY created_at DESC 
  LIMIT 1;
  
  IF v_quote IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No quote found');
  END IF;
  
  -- Check expiry
  IF v_quote.status = 'presented' AND v_quote.expires_at < NOW() THEN
    UPDATE notarized_translation_quotes SET status = 'expired' WHERE id = v_quote.id;
    v_quote.status := 'expired';
  END IF;
  
  RETURN jsonb_build_object(
    'ok', true,
    'quote_id', v_quote.id,
    'status', v_quote.status,
    'currency', v_quote.currency,
    'total_amount', v_quote.total_amount,
    'breakdown', v_quote.breakdown_json,
    'expires_at', v_quote.expires_at,
    'accepted_at', v_quote.accepted_at
  );
END;
$$;

-- Update precheck to store page_count
CREATE OR REPLACE FUNCTION public.rpc_notarized_job_set_precheck(
  p_job_id UUID,
  p_ok BOOLEAN,
  p_page_count INTEGER DEFAULT 1,
  p_quality_score NUMERIC DEFAULT NULL,
  p_quality_flags TEXT[] DEFAULT NULL,
  p_doc_type_guess TEXT DEFAULT NULL,
  p_doc_type_confidence NUMERIC DEFAULT NULL,
  p_rejection_code TEXT DEFAULT NULL,
  p_rejection_reasons TEXT[] DEFAULT NULL,
  p_fix_tips TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_new_status TEXT;
  v_all_passed BOOLEAN;
BEGIN
  SELECT order_id INTO v_order_id FROM notarized_translation_jobs WHERE id = p_job_id;
  
  v_new_status := CASE WHEN p_ok THEN 'awaiting_quote' ELSE 'precheck_rejected' END;
  
  UPDATE notarized_translation_jobs
  SET
    page_count = COALESCE(p_page_count, 1),
    quality_score = p_quality_score,
    quality_flags = p_quality_flags,
    doc_type_guess = p_doc_type_guess,
    doc_type_confidence = p_doc_type_confidence,
    rejection_code = CASE WHEN p_ok THEN NULL ELSE p_rejection_code END,
    rejection_reasons = CASE WHEN p_ok THEN NULL ELSE p_rejection_reasons END,
    fix_tips = CASE WHEN p_ok THEN NULL ELSE p_fix_tips END,
    status = v_new_status,
    updated_at = NOW()
  WHERE id = p_job_id;
  
  -- Check if all jobs passed
  SELECT NOT EXISTS (
    SELECT 1 FROM notarized_translation_jobs 
    WHERE order_id = v_order_id 
    AND status NOT IN ('awaiting_quote', 'awaiting_payment', 'paid', 'draft_ready')
  ) INTO v_all_passed;
  
  -- Update order status if all passed
  IF v_all_passed THEN
    UPDATE notarized_translation_orders 
    SET status = 'awaiting_quote', updated_at = NOW()
    WHERE id = v_order_id;
  END IF;
  
  -- Log event
  INSERT INTO notarized_translation_events (job_id, order_id, event_type, new_status, actor_type, meta)
  VALUES (
    p_job_id, v_order_id,
    CASE WHEN p_ok THEN 'precheck_pass' ELSE 'precheck_reject' END,
    v_new_status, 'system',
    jsonb_build_object('quality_score', p_quality_score, 'page_count', p_page_count, 'rejection_code', p_rejection_code)
  );
  
  RETURN jsonb_build_object('ok', true, 'status', v_new_status, 'all_passed', v_all_passed);
END;
$$;

-- Add unique constraint for quote per order
ALTER TABLE public.notarized_translation_quotes 
DROP CONSTRAINT IF EXISTS notarized_translation_quotes_order_unique;
-- Don't add unique - allow multiple quotes (expired ones)