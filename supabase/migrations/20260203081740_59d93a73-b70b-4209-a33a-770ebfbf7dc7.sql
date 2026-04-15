-- Fix templates table: add unique constraint and missing columns
-- ================================================

-- 1) Add unique constraint on template_id
ALTER TABLE public.notarized_translation_templates 
DROP CONSTRAINT IF EXISTS notarized_translation_templates_template_id_key;

ALTER TABLE public.notarized_translation_templates 
ADD CONSTRAINT notarized_translation_templates_template_id_key UNIQUE (template_id);

-- 2) Add missing columns
ALTER TABLE public.notarized_translation_templates 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 3) Insert/update template records
INSERT INTO public.notarized_translation_templates (template_id, version, doc_slot, placeholders, is_active)
VALUES 
  ('passport_ru_v1', 'v1', 'passport_ru', '{"page_size": "A4", "fields": ["full_name", "passport_number", "issue_date", "expiry_date", "nationality"]}'::jsonb, true),
  ('residence_ru_v1', 'v1', 'residence_ru', '{"page_size": "A4", "fields": ["full_name", "permit_number", "issue_date", "expiry_date", "address"]}'::jsonb, true),
  ('certificate_ru_v1', 'v1', 'certificate_ru', '{"page_size": "A4", "fields": ["full_name", "certificate_type", "issue_date", "issuing_authority"]}'::jsonb, true),
  ('transcript_ru_v1', 'v1', 'transcript_ru', '{"page_size": "A4", "fields": ["full_name", "institution", "degree", "graduation_date", "courses"]}'::jsonb, true)
ON CONFLICT (template_id) DO UPDATE SET
  placeholders = EXCLUDED.placeholders,
  is_active = EXCLUDED.is_active;

-- 4) Create mapping function
CREATE OR REPLACE FUNCTION public.get_template_for_doc_slot(p_doc_slot TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN CASE 
    WHEN p_doc_slot ILIKE '%passport%' THEN 'passport_ru_v1'
    WHEN p_doc_slot ILIKE '%residence%' THEN 'residence_ru_v1'
    WHEN p_doc_slot ILIKE '%certificate%' OR p_doc_slot ILIKE '%birth%' THEN 'certificate_ru_v1'
    WHEN p_doc_slot ILIKE '%transcript%' OR p_doc_slot ILIKE '%diploma%' THEN 'transcript_ru_v1'
    ELSE 'passport_ru_v1'
  END;
END;
$$;

-- 5) Add template_id to jobs
ALTER TABLE public.notarized_translation_jobs 
ADD COLUMN IF NOT EXISTS template_id TEXT;

UPDATE public.notarized_translation_jobs 
SET template_id = get_template_for_doc_slot(doc_slot)
WHERE template_id IS NULL;

-- 6) Pricing rules
CREATE TABLE IF NOT EXISTS public.notarized_pricing_rules (
  doc_slot TEXT PRIMARY KEY,
  currency TEXT NOT NULL DEFAULT 'RUB',
  base_fee NUMERIC(10,2) NOT NULL DEFAULT 2000.00,
  extra_page_fee NUMERIC(10,2) NOT NULL DEFAULT 500.00,
  complexity_surcharge NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notarized_pricing_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pricing rules readable" ON public.notarized_pricing_rules;
CREATE POLICY "Pricing rules readable" ON public.notarized_pricing_rules FOR SELECT TO authenticated USING (true);

INSERT INTO public.notarized_pricing_rules (doc_slot, base_fee, extra_page_fee, complexity_surcharge)
VALUES 
  ('passport_ru', 2000.00, 500.00, 0.00),
  ('residence_ru', 2500.00, 600.00, 0.00),
  ('certificate_ru', 2000.00, 500.00, 0.00),
  ('transcript_ru', 3000.00, 400.00, 500.00),
  ('birth_certificate_ru', 2000.00, 500.00, 0.00),
  ('diploma_ru', 3000.00, 400.00, 500.00),
  ('medical_ru', 2500.00, 500.00, 0.00)
ON CONFLICT (doc_slot) DO UPDATE SET base_fee = EXCLUDED.base_fee, extra_page_fee = EXCLUDED.extra_page_fee;

-- 7) Order creation RPC with template_id
CREATE OR REPLACE FUNCTION public.rpc_notarized_order_create(
  p_doc_slots TEXT[],
  p_delivery_mode TEXT DEFAULT 'digital',
  p_notify_channels TEXT[] DEFAULT ARRAY['email']
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_order_id UUID;
  v_job_ids UUID[] := ARRAY[]::UUID[];
  v_job_id UUID;
  v_slot TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated'); END IF;

  INSERT INTO notarized_translation_orders (user_id, delivery_mode, notify_channels, doc_slots)
  VALUES (v_user_id, p_delivery_mode, p_notify_channels, p_doc_slots)
  RETURNING id INTO v_order_id;

  FOREACH v_slot IN ARRAY p_doc_slots LOOP
    INSERT INTO notarized_translation_jobs (order_id, doc_slot, template_id, status)
    VALUES (v_order_id, v_slot, get_template_for_doc_slot(v_slot), 'awaiting_upload')
    RETURNING id INTO v_job_id;
    v_job_ids := array_append(v_job_ids, v_job_id);
  END LOOP;

  INSERT INTO notarized_translation_events (order_id, event_type, old_status, new_status)
  VALUES (v_order_id, 'order_created', NULL, 'created');

  RETURN jsonb_build_object('ok', true, 'order_id', v_order_id, 'job_ids', v_job_ids);
END;
$$;

-- 8) Quote creation with correct formula: base + max(pages-1,0)*extra
CREATE OR REPLACE FUNCTION public.rpc_notarized_quote_create(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_order RECORD;
  v_job RECORD;
  v_quote_id UUID;
  v_line_items JSONB := '[]'::jsonb;
  v_total NUMERIC(10,2) := 0;
  v_line NUMERIC(10,2);
  v_pr RECORD;
  v_extra INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated'); END IF;

  SELECT * INTO v_order FROM notarized_translation_orders WHERE id = p_order_id AND user_id = v_user_id;
  IF v_order IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'order_not_found'); END IF;
  IF v_order.status NOT IN ('awaiting_quote', 'quote_presented') THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_order_status'); END IF;

  UPDATE notarized_translation_quotes SET status = 'expired', updated_at = now() WHERE order_id = p_order_id AND status = 'presented';

  FOR v_job IN SELECT * FROM notarized_translation_jobs WHERE order_id = p_order_id LOOP
    SELECT * INTO v_pr FROM notarized_pricing_rules WHERE doc_slot = v_job.doc_slot AND is_active = true;
    IF v_pr IS NULL THEN v_pr := ROW('default', 'RUB', 2000.00, 500.00, 0.00, true, now()); END IF;

    v_extra := GREATEST(COALESCE(v_job.page_count, 1) - 1, 0);
    v_line := v_pr.base_fee + (v_extra * v_pr.extra_page_fee) + COALESCE(v_pr.complexity_surcharge, 0);
    
    v_line_items := v_line_items || jsonb_build_object(
      'job_id', v_job.id, 'doc_slot', v_job.doc_slot, 'page_count', COALESCE(v_job.page_count, 1),
      'base_fee', v_pr.base_fee, 'extra_pages', v_extra, 'extra_page_fee', v_pr.extra_page_fee,
      'complexity_surcharge', COALESCE(v_pr.complexity_surcharge, 0), 'line_total', v_line
    );
    v_total := v_total + v_line;
  END LOOP;

  INSERT INTO notarized_translation_quotes (order_id, currency, total_amount, breakdown_json, status, expires_at)
  VALUES (p_order_id, 'RUB', v_total, jsonb_build_object('line_items', v_line_items, 'total', v_total), 'presented', now() + interval '24 hours')
  RETURNING id INTO v_quote_id;

  UPDATE notarized_translation_orders SET status = 'quote_presented', updated_at = now() WHERE id = p_order_id;
  INSERT INTO notarized_translation_events (order_id, event_type, old_status, new_status, meta)
  VALUES (p_order_id, 'quote_created', v_order.status, 'quote_presented', jsonb_build_object('quote_id', v_quote_id, 'total', v_total));

  RETURN jsonb_build_object('ok', true, 'quote_id', v_quote_id, 'total_amount', v_total, 'currency', 'RUB', 'breakdown', jsonb_build_object('line_items', v_line_items, 'total', v_total), 'expires_at', now() + interval '24 hours');
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_translation_quote_create(p_order_id UUID)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT rpc_notarized_quote_create(p_order_id); $$;

-- 9) Quote accept
CREATE OR REPLACE FUNCTION public.rpc_notarized_quote_accept(p_quote_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_quote RECORD;
  v_order_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated'); END IF;

  SELECT q.*, o.user_id as owner INTO v_quote FROM notarized_translation_quotes q JOIN notarized_translation_orders o ON o.id = q.order_id WHERE q.id = p_quote_id;
  IF v_quote IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'quote_not_found'); END IF;
  IF v_quote.owner != v_user_id THEN RETURN jsonb_build_object('ok', false, 'error', 'unauthorized'); END IF;
  IF v_quote.status != 'presented' THEN RETURN jsonb_build_object('ok', false, 'error', 'quote_not_presented'); END IF;
  IF v_quote.expires_at < now() THEN UPDATE notarized_translation_quotes SET status = 'expired' WHERE id = p_quote_id; RETURN jsonb_build_object('ok', false, 'error', 'quote_expired'); END IF;

  v_order_id := v_quote.order_id;
  UPDATE notarized_translation_quotes SET status = 'accepted', accepted_at = now() WHERE id = p_quote_id;
  UPDATE notarized_translation_orders SET status = 'awaiting_payment' WHERE id = v_order_id;
  UPDATE notarized_translation_jobs SET status = 'awaiting_payment' WHERE order_id = v_order_id;
  INSERT INTO notarized_translation_events (order_id, event_type, old_status, new_status, meta) VALUES (v_order_id, 'quote_accepted', 'quote_presented', 'awaiting_payment', jsonb_build_object('quote_id', p_quote_id));

  RETURN jsonb_build_object('ok', true, 'order_id', v_order_id, 'status', 'awaiting_payment');
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_translation_quote_accept(p_quote_id UUID)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT rpc_notarized_quote_accept(p_quote_id); $$;