-- 1) توسعة جدول البرامج بحقول التفاصيل الكاملة
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS teaching_language text DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS delivery_mode text CHECK (delivery_mode IN ('on-campus','online','hybrid')) DEFAULT 'on-campus',
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS currency_code text,
  ADD COLUMN IF NOT EXISTS tuition_yearly numeric,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2) فهرس لتفادي التكرار (جامعة + اسم برنامج + لغة + درجة)
CREATE UNIQUE INDEX IF NOT EXISTS uq_program_name_uni_lang_deg
ON programs (university_id, title, COALESCE(teaching_language,'en'), COALESCE(degree_id::text,''));

-- 3) جدول مواعيد القبول المتعددة (اختياري)
CREATE TABLE IF NOT EXISTS program_intakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid REFERENCES programs(id) ON DELETE CASCADE,
  intake_date date NOT NULL,
  intake_label text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_program_intakes_pid ON program_intakes(program_id, intake_date);

-- 4) جداول مساعد الذكاء للإثراء
CREATE TABLE IF NOT EXISTS ai_enrichment_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('university','program')),
  target_id uuid,
  source_urls jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','error')),
  result jsonb,
  error text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_enrichment_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES ai_enrichment_jobs(id) ON DELETE CASCADE,
  field text NOT NULL,
  proposed_value jsonb NOT NULL,
  confidence numeric CHECK (confidence >= 0 AND confidence <= 1),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- 5) RLS للجداول الجديدة (أدمن فقط)
ALTER TABLE program_intakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_enrichment_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_enrichment_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "program_intakes_admin_all" ON program_intakes
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "ai_jobs_admin_all" ON ai_enrichment_jobs
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "ai_suggestions_admin_all" ON ai_enrichment_suggestions
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- 6) Trigger لتحديث updated_at
CREATE OR REPLACE FUNCTION update_programs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS programs_updated_at_trigger ON programs;
CREATE TRIGGER programs_updated_at_trigger
  BEFORE UPDATE ON programs
  FOR EACH ROW
  EXECUTE FUNCTION update_programs_updated_at();