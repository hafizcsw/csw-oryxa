
-- Course products (course types per language)
CREATE TABLE public.language_course_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_key TEXT NOT NULL DEFAULT 'russian',
  course_type TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  description_en TEXT,
  description_ar TEXT,
  price_usd NUMERIC(10,2) NOT NULL,
  duration_months INTEGER,
  features JSONB DEFAULT '[]'::jsonb,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cohorts (group start dates)
CREATE TABLE public.language_course_cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.language_course_products(id) ON DELETE CASCADE,
  language_key TEXT NOT NULL DEFAULT 'russian',
  start_date DATE NOT NULL,
  capacity INTEGER DEFAULT 18,
  min_to_start INTEGER DEFAULT 7,
  status TEXT NOT NULL DEFAULT 'registration_open',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enrollment requests (the main operational table)
CREATE TABLE public.language_course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  language_key TEXT NOT NULL DEFAULT 'russian',
  product_id UUID REFERENCES public.language_course_products(id),
  cohort_id UUID REFERENCES public.language_course_cohorts(id),
  course_type TEXT NOT NULL,
  price_usd NUMERIC(10,2) NOT NULL,
  payment_method TEXT DEFAULT 'bank_transfer',
  proof_url TEXT,
  proof_uploaded_at TIMESTAMPTZ,
  request_status TEXT NOT NULL DEFAULT 'draft',
  payment_proof_status TEXT NOT NULL DEFAULT 'no_proof',
  admin_note TEXT,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  activation_status TEXT NOT NULL DEFAULT 'inactive',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.language_course_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.language_course_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.language_course_enrollments ENABLE ROW LEVEL SECURITY;

-- Products: public read
CREATE POLICY "Anyone can read active products"
  ON public.language_course_products FOR SELECT
  USING (is_active = true);

-- Cohorts: public read
CREATE POLICY "Anyone can read cohorts"
  ON public.language_course_cohorts FOR SELECT
  USING (true);

-- Enrollments: users can read own
CREATE POLICY "Users can read own enrollments"
  ON public.language_course_enrollments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert own enrollments
CREATE POLICY "Users can insert own enrollments"
  ON public.language_course_enrollments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update own draft/submitted enrollments
CREATE POLICY "Users can update own enrollments"
  ON public.language_course_enrollments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND request_status IN ('draft', 'submitted'));

-- Admin policies using has_role
CREATE POLICY "Admins can read all enrollments"
  ON public.language_course_enrollments FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update enrollments"
  ON public.language_course_enrollments FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage products"
  ON public.language_course_products FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage cohorts"
  ON public.language_course_cohorts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Storage bucket for payment proofs
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', false);

-- Storage RLS: users can upload their own proofs
CREATE POLICY "Users can upload payment proofs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Users can read their own proofs
CREATE POLICY "Users can read own payment proofs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Admins can read all payment proofs
CREATE POLICY "Admins can read all payment proofs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(), 'admin'));
