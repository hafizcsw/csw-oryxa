-- =====================================================
-- PRICING RULES: Single Source of Truth for Translation Pricing
-- =====================================================

-- Drop existing table if exists (clean slate)
DROP TABLE IF EXISTS notarized_pricing_rules CASCADE;

-- Create pricing rules table
CREATE TABLE notarized_pricing_rules (
  id BIGSERIAL PRIMARY KEY,
  country_code TEXT NOT NULL DEFAULT 'RU',
  doc_slot TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  base_price_minor INT NOT NULL,          -- e.g., $39 = 3900 cents
  extra_page_price_minor INT NOT NULL,    -- e.g., $7 = 700 cents  
  vat_rate NUMERIC(5,4) NOT NULL DEFAULT 0.05, -- 5% VAT
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (country_code, doc_slot, is_active)
);

-- Insert default pricing for Russia (RU)
INSERT INTO notarized_pricing_rules (country_code, doc_slot, currency, base_price_minor, extra_page_price_minor, vat_rate)
VALUES
  ('RU', 'passport', 'USD', 3900, 700, 0.05),
  ('RU', 'certificate', 'USD', 4900, 700, 0.05),
  ('RU', 'transcript', 'USD', 4500, 700, 0.05),
  ('RU', 'residence', 'USD', 4500, 700, 0.05),
  ('RU', 'birth_certificate', 'USD', 3900, 700, 0.05),
  ('RU', 'diploma', 'USD', 4900, 700, 0.05),
  ('RU', 'medical', 'USD', 3500, 700, 0.05);

-- Enable RLS
ALTER TABLE notarized_pricing_rules ENABLE ROW LEVEL SECURITY;

-- Public read access for pricing
CREATE POLICY "Anyone can read active pricing rules"
  ON notarized_pricing_rules
  FOR SELECT
  USING (is_active = TRUE);

-- =====================================================
-- RPC: Calculate Quote with VAT (Single Source of Truth)
-- =====================================================

-- Drop all existing signatures first
DROP FUNCTION IF EXISTS rpc_notarized_quote_calc(UUID);
DROP FUNCTION IF EXISTS rpc_notarized_quote_calc(UUID, TEXT);

-- Create the unified quote calculation RPC
CREATE OR REPLACE FUNCTION rpc_notarized_quote_calc(
  p_order_id UUID,
  p_country_code TEXT DEFAULT 'RU'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_customer_id UUID;
  v_line_items JSONB := '[]'::JSONB;
  v_subtotal_minor INT := 0;
  v_vat_minor INT := 0;
  v_total_minor INT := 0;
  v_vat_rate NUMERIC := 0.05;
  v_currency TEXT := 'USD';
  v_job RECORD;
  v_pricing RECORD;
  v_item_subtotal INT;
  v_extra_pages INT;
  v_missing_slots TEXT[] := '{}';
BEGIN
  -- Verify order ownership
  SELECT customer_id INTO v_order_customer_id
  FROM notarized_translation_orders
  WHERE id = p_order_id;

  IF v_order_customer_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'order_not_found');
  END IF;

  IF v_order_customer_id != auth.uid() THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'unauthorized');
  END IF;

  -- Iterate over all jobs that are ready for pricing
  FOR v_job IN
    SELECT id, doc_slot, page_count
    FROM notarized_translation_jobs
    WHERE order_id = p_order_id
      AND status IN ('awaiting_quote', 'quoted', 'paid', 'processing_ocr', 'processing_extract', 'processing_translate', 'processing_render', 'draft_ready', 'delivered')
      AND page_count IS NOT NULL
      AND page_count > 0
  LOOP
    -- Get pricing for this doc_slot
    SELECT base_price_minor, extra_page_price_minor, vat_rate, currency
    INTO v_pricing
    FROM notarized_pricing_rules
    WHERE country_code = p_country_code
      AND doc_slot = v_job.doc_slot
      AND is_active = TRUE
    LIMIT 1;

    IF v_pricing.base_price_minor IS NULL THEN
      -- Track missing pricing
      v_missing_slots := array_append(v_missing_slots, v_job.doc_slot);
      CONTINUE;
    END IF;

    -- Calculate: base + (max(pages-1, 0) * extra_page)
    v_extra_pages := GREATEST(COALESCE(v_job.page_count, 1) - 1, 0);
    v_item_subtotal := v_pricing.base_price_minor + (v_extra_pages * v_pricing.extra_page_price_minor);
    v_subtotal_minor := v_subtotal_minor + v_item_subtotal;
    v_vat_rate := COALESCE(v_pricing.vat_rate, 0.05);
    v_currency := COALESCE(v_pricing.currency, 'USD');

    -- Add to line items
    v_line_items := v_line_items || jsonb_build_object(
      'job_id', v_job.id,
      'doc_slot', v_job.doc_slot,
      'page_count', COALESCE(v_job.page_count, 1),
      'base_fee', v_pricing.base_price_minor,
      'extra_pages_fee', v_extra_pages * v_pricing.extra_page_price_minor,
      'extra_pages', v_extra_pages,
      'line_total', v_item_subtotal,
      'currency', v_currency
    );
  END LOOP;

  -- If we have missing pricing, return error
  IF array_length(v_missing_slots, 1) > 0 THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'pricing_missing',
      'missing_slots', to_jsonb(v_missing_slots)
    );
  END IF;

  -- If no items to price
  IF v_subtotal_minor = 0 THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'no_items_to_price'
    );
  END IF;

  -- Calculate VAT (round to nearest minor unit)
  v_vat_minor := ROUND(v_subtotal_minor * v_vat_rate)::INT;
  v_total_minor := v_subtotal_minor + v_vat_minor;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'subtotal_minor', v_subtotal_minor,
    'vat_minor', v_vat_minor,
    'vat_rate', v_vat_rate,
    'total_minor', v_total_minor,
    'currency', v_currency,
    'line_items', v_line_items
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION rpc_notarized_quote_calc(UUID, TEXT) TO authenticated;