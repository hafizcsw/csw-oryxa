
-- ==========================================
-- Part 1: program_offers
-- ==========================================
CREATE TABLE public.program_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  faculty TEXT,
  department TEXT,
  campus TEXT,
  intake_term TEXT,
  intake_year INTEGER,
  teaching_language TEXT,
  study_mode TEXT,
  delivery_mode TEXT,
  seats_total INTEGER,
  seats_available INTEGER,
  seats_status TEXT DEFAULT 'open',
  waitlist_count INTEGER DEFAULT 0,
  application_deadline DATE,
  apply_url TEXT,
  offer_status TEXT DEFAULT 'active',
  currency_code TEXT,
  tuition_amount NUMERIC,
  tuition_basis TEXT DEFAULT 'yearly',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.program_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active offers"
  ON public.program_offers FOR SELECT
  USING (offer_status = 'active');

CREATE POLICY "Authenticated users can manage offers"
  ON public.program_offers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_program_offers_program ON public.program_offers(program_id);
CREATE INDEX idx_program_offers_university ON public.program_offers(university_id);
CREATE INDEX idx_program_offers_status ON public.program_offers(offer_status);

-- ==========================================
-- Part 2: scholarship_links
-- ==========================================
CREATE TABLE public.scholarship_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scholarship_id UUID NOT NULL REFERENCES public.scholarships(id) ON DELETE CASCADE,
  university_id UUID REFERENCES public.universities(id) ON DELETE CASCADE,
  program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE,
  offer_id UUID REFERENCES public.program_offers(id) ON DELETE SET NULL,
  scope TEXT NOT NULL DEFAULT 'university',
  seats_allocated INTEGER,
  seats_used INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.scholarship_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active links"
  ON public.scholarship_links FOR SELECT
  USING (is_active = true);

CREATE POLICY "Authenticated can manage links"
  ON public.scholarship_links FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_scholarship_links_scholarship ON public.scholarship_links(scholarship_id);
CREATE INDEX idx_scholarship_links_program ON public.scholarship_links(program_id);
CREATE INDEX idx_scholarship_links_offer ON public.scholarship_links(offer_id);

-- ==========================================
-- Part 3: program_ai_snapshots
-- ==========================================
CREATE TABLE public.program_ai_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  summary TEXT,
  future_outlook TEXT,
  strengths JSONB,
  weaknesses JSONB,
  practical_assessment TEXT,
  career_paths JSONB,
  best_fit_profile TEXT,
  confidence NUMERIC,
  model_version TEXT,
  source_hash TEXT,
  generated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_current BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.program_ai_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read current snapshots"
  ON public.program_ai_snapshots FOR SELECT
  USING (is_current = true);

CREATE POLICY "Authenticated can manage snapshots"
  ON public.program_ai_snapshots FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE UNIQUE INDEX idx_program_ai_snapshots_current ON public.program_ai_snapshots(program_id) WHERE is_current = true;

-- ==========================================
-- Part 4: program_orx_signals
-- ==========================================
CREATE TABLE public.program_orx_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  labs_score NUMERIC,
  internship_score NUMERIC,
  capstone_score NUMERIC,
  tooling_score NUMERIC,
  industry_links_score NUMERIC,
  curriculum_modernity NUMERIC,
  practical_intensity NUMERIC,
  employability_relevance NUMERIC,
  overall_execution_score NUMERIC,
  discipline_future_strength NUMERIC,
  evidence JSONB,
  model_version TEXT,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  is_current BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.program_orx_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read current signals"
  ON public.program_orx_signals FOR SELECT
  USING (is_current = true);

CREATE POLICY "Authenticated can manage signals"
  ON public.program_orx_signals FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE UNIQUE INDEX idx_program_orx_current ON public.program_orx_signals(program_id) WHERE is_current = true;

-- ==========================================
-- Part 5: program_ingestion_jobs
-- ==========================================
CREATE TABLE public.program_ingestion_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_name TEXT,
  status TEXT DEFAULT 'pending',
  error TEXT,
  ai_result JSONB,
  model_used TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.program_ingestion_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own jobs"
  ON public.program_ingestion_jobs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create jobs"
  ON public.program_ingestion_jobs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own jobs"
  ON public.program_ingestion_jobs FOR UPDATE
  TO authenticated
  USING (true);

-- ==========================================
-- Part 5b: program_ingestion_proposals
-- ==========================================
CREATE TABLE public.program_ingestion_proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.program_ingestion_jobs(id) ON DELETE CASCADE,
  target_entity TEXT NOT NULL,
  target_id UUID,
  target_field TEXT NOT NULL,
  proposed_value JSONB NOT NULL,
  confidence NUMERIC,
  evidence_snippet TEXT,
  review_status TEXT DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.program_ingestion_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read proposals"
  ON public.program_ingestion_proposals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can manage proposals"
  ON public.program_ingestion_proposals FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_ingestion_proposals_job ON public.program_ingestion_proposals(job_id);
CREATE INDEX idx_ingestion_proposals_status ON public.program_ingestion_proposals(review_status);

-- ==========================================
-- Part 6: university_program_intelligence
-- ==========================================
CREATE TABLE public.university_program_intelligence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  metric_value NUMERIC NOT NULL DEFAULT 0,
  breakdown JSONB,
  computed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(university_id, program_id, period, metric_key)
);

ALTER TABLE public.university_program_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read intelligence"
  ON public.university_program_intelligence FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can manage intelligence"
  ON public.university_program_intelligence FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_uni_intelligence_uni ON public.university_program_intelligence(university_id);
CREATE INDEX idx_uni_intelligence_program ON public.university_program_intelligence(program_id);
CREATE INDEX idx_uni_intelligence_period ON public.university_program_intelligence(period);

-- ==========================================
-- Auto-migrate: Create default offer per existing program
-- (Safe: avoids casting intake_months to int)
-- ==========================================
INSERT INTO public.program_offers (
  program_id, university_id, teaching_language, study_mode, delivery_mode,
  seats_total, seats_available, seats_status,
  application_deadline, apply_url, offer_status,
  currency_code, tuition_amount, tuition_basis
)
SELECT 
  p.id,
  p.university_id,
  COALESCE(p.teaching_language, p.language),
  p.study_mode,
  p.delivery_mode,
  p.seats_total,
  p.seats_available,
  COALESCE(p.seats_status, 'open'),
  p.application_deadline,
  p.apply_url,
  CASE WHEN p.is_active = true AND p.publish_status = 'published' THEN 'active' ELSE 'draft' END,
  p.currency_code,
  p.tuition_yearly,
  'yearly'
FROM public.programs p;

-- Storage bucket for ingestion uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('program-ingestion', 'program-ingestion', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can upload ingestion files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'program-ingestion');

CREATE POLICY "Authenticated can read ingestion files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'program-ingestion');
