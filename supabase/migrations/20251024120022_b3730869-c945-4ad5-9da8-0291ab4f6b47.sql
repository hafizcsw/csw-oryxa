-- إضافة حقول المراجعة إلى ingestion_results
ALTER TABLE ingestion_results
  ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verified_by UUID,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- إنشاء جدول قائمة المراجعة النهائية
CREATE TABLE IF NOT EXISTS harvest_review_queue (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ingestion_id UUID REFERENCES ingestion_results(id) ON DELETE CASCADE,
  university_name TEXT NOT NULL,
  country_code TEXT NOT NULL,
  has_tuition BOOLEAN DEFAULT FALSE,
  has_admissions BOOLEAN DEFAULT FALSE,
  has_programs BOOLEAN DEFAULT FALSE,
  tuition_range TEXT,
  programs JSONB DEFAULT '[]'::jsonb,
  languages TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified BOOLEAN DEFAULT FALSE,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT
);

CREATE INDEX IF NOT EXISTS ix_review_verified ON harvest_review_queue(verified);
CREATE INDEX IF NOT EXISTS ix_review_created ON harvest_review_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS ix_review_country ON harvest_review_queue(country_code);

-- RLS policies
ALTER TABLE harvest_review_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage review queue"
  ON harvest_review_queue
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- دالة لملء قائمة المراجعة تلقائياً بعد الحصاد
CREATE OR REPLACE FUNCTION populate_review_queue_from_run(p_run_id BIGINT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  INSERT INTO harvest_review_queue (
    ingestion_id,
    university_name,
    country_code,
    has_tuition,
    has_admissions,
    has_programs,
    tuition_range,
    programs,
    languages
  )
  SELECT 
    r.id,
    COALESCE(r.university_data->>'name', 'Unknown'),
    COALESCE(r.university_data->>'country_code', ''),
    (r.mapped->>'tuition') IS NOT NULL,
    (r.mapped->>'admissions') IS NOT NULL,
    jsonb_array_length(COALESCE(r.programs_data, '[]'::jsonb)) > 0,
    r.mapped->>'tuition_range',
    COALESCE(r.programs_data, '[]'::jsonb),
    CASE 
      WHEN r.mapped->>'languages' IS NOT NULL 
      THEN string_to_array(r.mapped->>'languages', ',')
      ELSE ARRAY[]::TEXT[]
    END
  FROM ingestion_results r
  WHERE r.job_id::text = p_run_id::text
    AND r.status = 'draft'
    AND NOT EXISTS (
      SELECT 1 FROM harvest_review_queue q 
      WHERE q.ingestion_id = r.id
    );
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;