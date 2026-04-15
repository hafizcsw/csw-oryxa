-- ============================================
-- NOTARIZED TRANSLATION SYSTEM - COMPLETE
-- ============================================

-- 1. Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. CORE TABLES
-- ============================================

-- 2.1 Orders
CREATE TABLE IF NOT EXISTS public.notarized_translation_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  visitor_id TEXT,
  
  delivery_mode TEXT NOT NULL DEFAULT 'digital' CHECK (delivery_mode IN ('digital', 'physical', 'both')),
  notify_channels TEXT[] DEFAULT ARRAY['email'],
  
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN (
    'created', 'awaiting_upload', 'awaiting_precheck', 'precheck_rejected',
    'awaiting_payment', 'paid', 'processing', 'draft_ready', 
    'notarized_scan_ready', 'delivered', 'failed', 'purged'
  )),
  
  price_cents INTEGER,
  currency TEXT DEFAULT 'USD',
  payment_ref TEXT,
  
  doc_slots TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  notes TEXT,
  
  retention_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days'),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.2 Jobs
CREATE TABLE IF NOT EXISTS public.notarized_translation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.notarized_translation_orders(id) ON DELETE CASCADE,
  
  doc_slot TEXT NOT NULL,
  doc_type_guess TEXT,
  doc_type_confidence NUMERIC(3,2),
  
  status TEXT NOT NULL DEFAULT 'awaiting_upload' CHECK (status IN (
    'awaiting_upload', 'awaiting_precheck', 'precheck_rejected',
    'awaiting_payment', 'paid', 'processing_ocr', 'processing_extract',
    'processing_translate', 'processing_render', 'draft_ready', 'failed', 'purged'
  )),
  
  quality_score NUMERIC(3,2),
  quality_flags TEXT[],
  rejection_code TEXT,
  rejection_reasons TEXT[],
  fix_tips TEXT[],
  
  original_path TEXT,
  original_meta JSONB,
  draft_docx_path TEXT,
  draft_pdf_path TEXT,
  scan_pdf_path TEXT,
  extracted_json_path TEXT,
  
  template_id TEXT,
  template_version TEXT DEFAULT 'v1',
  processing_meta JSONB,
  error_message TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.3 Events
CREATE TABLE IF NOT EXISTS public.notarized_translation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.notarized_translation_jobs(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.notarized_translation_orders(id) ON DELETE CASCADE,
  
  event_type TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  
  actor_id UUID,
  actor_type TEXT DEFAULT 'system',
  
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.4 Templates
CREATE TABLE IF NOT EXISTS public.notarized_translation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT 'v1',
  
  doc_slot TEXT NOT NULL,
  outputs TEXT[] DEFAULT ARRAY['docx', 'pdf'],
  
  master_docx_path TEXT,
  metadata_json_path TEXT,
  placeholders JSONB,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(template_id, version)
);

-- 2.5 Queue
CREATE TABLE IF NOT EXISTS public.notarized_translation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.notarized_translation_jobs(id) ON DELETE CASCADE,
  
  priority INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  
  locked_by TEXT,
  locked_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.6 Notifications
CREATE TABLE IF NOT EXISTS public.notarized_translation_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  order_id UUID REFERENCES public.notarized_translation_orders(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.notarized_translation_jobs(id) ON DELETE CASCADE,
  
  channel TEXT NOT NULL,
  recipient TEXT NOT NULL,
  template_key TEXT NOT NULL,
  payload JSONB,
  
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 3. INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_notarized_orders_customer ON public.notarized_translation_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_notarized_orders_status ON public.notarized_translation_orders(status);
CREATE INDEX IF NOT EXISTS idx_notarized_jobs_order ON public.notarized_translation_jobs(order_id);
CREATE INDEX IF NOT EXISTS idx_notarized_jobs_status ON public.notarized_translation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_notarized_events_job ON public.notarized_translation_events(job_id);
CREATE INDEX IF NOT EXISTS idx_notarized_queue_next ON public.notarized_translation_queue(next_attempt_at) WHERE locked_by IS NULL;

-- ============================================
-- 4. TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS update_notarized_orders_updated_at ON public.notarized_translation_orders;
CREATE TRIGGER update_notarized_orders_updated_at
  BEFORE UPDATE ON public.notarized_translation_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_notarized_jobs_updated_at ON public.notarized_translation_jobs;
CREATE TRIGGER update_notarized_jobs_updated_at
  BEFORE UPDATE ON public.notarized_translation_jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- 5. RLS POLICIES
-- ============================================

ALTER TABLE public.notarized_translation_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notarized_translation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notarized_translation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notarized_translation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notarized_translation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notarized_translation_notifications ENABLE ROW LEVEL SECURITY;

-- Orders policies
DROP POLICY IF EXISTS "Customers view own notarized orders" ON public.notarized_translation_orders;
CREATE POLICY "Customers view own notarized orders"
  ON public.notarized_translation_orders FOR SELECT
  USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers create own notarized orders" ON public.notarized_translation_orders;
CREATE POLICY "Customers create own notarized orders"
  ON public.notarized_translation_orders FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

-- Jobs policies
DROP POLICY IF EXISTS "Customers view own notarized jobs" ON public.notarized_translation_jobs;
CREATE POLICY "Customers view own notarized jobs"
  ON public.notarized_translation_jobs FOR SELECT
  USING (order_id IN (SELECT id FROM public.notarized_translation_orders WHERE customer_id = auth.uid()));

-- Events policies
DROP POLICY IF EXISTS "Customers view own notarized events" ON public.notarized_translation_events;
CREATE POLICY "Customers view own notarized events"
  ON public.notarized_translation_events FOR SELECT
  USING (order_id IN (SELECT id FROM public.notarized_translation_orders WHERE customer_id = auth.uid()));

-- Templates policies
DROP POLICY IF EXISTS "Anyone views active notarized templates" ON public.notarized_translation_templates;
CREATE POLICY "Anyone views active notarized templates"
  ON public.notarized_translation_templates FOR SELECT
  USING (is_active = true);

-- ============================================
-- 6. STORAGE BUCKETS
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('notarized_originals', 'notarized_originals', false),
  ('notarized_drafts', 'notarized_drafts', false),
  ('notarized_scans', 'notarized_scans', false),
  ('notarized_templates', 'notarized_templates', false),
  ('notarized_artifacts', 'notarized_artifacts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Customers upload notarized originals" ON storage.objects;
CREATE POLICY "Customers upload notarized originals"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'notarized_originals' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Customers view notarized originals" ON storage.objects;
CREATE POLICY "Customers view notarized originals"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'notarized_originals' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Customers view notarized drafts" ON storage.objects;
CREATE POLICY "Customers view notarized drafts"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'notarized_drafts' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Customers view notarized scans" ON storage.objects;
CREATE POLICY "Customers view notarized scans"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'notarized_scans' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );