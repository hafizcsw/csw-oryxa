-- 1) لقطات أسعار (official/aux)
CREATE TABLE IF NOT EXISTS tuition_snapshots (
  id            bigserial PRIMARY KEY,
  university_id uuid REFERENCES universities(id) ON DELETE CASCADE,
  degree_level  text,
  audience      text,
  amount        numeric,
  currency      text,
  amount_usd    numeric,
  academic_year text,
  source_url    text NOT NULL,
  source_name   text NOT NULL,
  is_official   boolean DEFAULT false,
  content_hash  text,
  captured_at   timestamptz DEFAULT now(),
  confidence    numeric
);

CREATE INDEX IF NOT EXISTS ix_tuition_snap_u ON tuition_snapshots (university_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS ix_tuition_snap_official ON tuition_snapshots (university_id, is_official, captured_at DESC);

-- 2) الحالة الحالية لكل جامعة
CREATE TABLE IF NOT EXISTS tuition_consensus (
  university_id uuid PRIMARY KEY REFERENCES universities(id) ON DELETE CASCADE,
  snapshot_id   bigint REFERENCES tuition_snapshots(id),
  updated_at    timestamptz DEFAULT now()
);

-- 3) مقترحات تعديل
CREATE TABLE IF NOT EXISTS tuition_change_proposals (
  id            bigserial PRIMARY KEY,
  university_id uuid REFERENCES universities(id) ON DELETE CASCADE,
  old_snapshot  bigint REFERENCES tuition_snapshots(id),
  new_snapshot  bigint REFERENCES tuition_snapshots(id),
  diff_percent  numeric,
  reason        text,
  status        text DEFAULT 'pending',
  created_at    timestamptz DEFAULT now(),
  decided_by    uuid,
  decided_at    timestamptz
);

CREATE INDEX IF NOT EXISTS ix_tuition_proposals_status ON tuition_change_proposals (status, created_at DESC);

-- 4) تحديث جدول scholarships الموجود (إضافة أعمدة جديدة إن لم تكن موجودة)
DO $$ 
BEGIN
  -- إضافة source_name إذا لم يكن موجوداً
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scholarships' AND column_name='source_name') THEN
    ALTER TABLE scholarships ADD COLUMN source_name text;
  END IF;
  
  -- إضافة provider إذا لم يكن موجوداً  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scholarships' AND column_name='provider') THEN
    ALTER TABLE scholarships ADD COLUMN provider text;
  END IF;
  
  -- إضافة country_code إذا لم يكن موجوداً
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scholarships' AND column_name='country_code') THEN
    ALTER TABLE scholarships ADD COLUMN country_code text;
  END IF;
  
  -- إضافة study_level إذا لم يكن موجوداً
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scholarships' AND column_name='study_level') THEN
    ALTER TABLE scholarships ADD COLUMN study_level text;
  END IF;
  
  -- إضافة coverage إذا لم يكن موجوداً
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scholarships' AND column_name='coverage') THEN
    ALTER TABLE scholarships ADD COLUMN coverage jsonb;
  END IF;
  
  -- إضافة amount_type إذا لم يكن موجوداً
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scholarships' AND column_name='amount_type') THEN
    ALTER TABLE scholarships ADD COLUMN amount_type text;
  END IF;
  
  -- إضافة amount_value إذا لم يكن موجوداً
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scholarships' AND column_name='amount_value') THEN
    ALTER TABLE scholarships ADD COLUMN amount_value numeric;
  END IF;
  
  -- إضافة link إذا لم يكن موجوداً
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scholarships' AND column_name='link') THEN
    ALTER TABLE scholarships ADD COLUMN link text;
  END IF;
  
  -- إضافة eligibility إذا لم يكن موجوداً
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scholarships' AND column_name='eligibility') THEN
    ALTER TABLE scholarships ADD COLUMN eligibility jsonb;
  END IF;
  
  -- إضافة academic_year إذا لم يكن موجوداً
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scholarships' AND column_name='academic_year') THEN
    ALTER TABLE scholarships ADD COLUMN academic_year text;
  END IF;
  
  -- إضافة content_hash إذا لم يكن موجوداً
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scholarships' AND column_name='content_hash') THEN
    ALTER TABLE scholarships ADD COLUMN content_hash text;
  END IF;
  
  -- إضافة captured_at إذا لم يكن موجوداً
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scholarships' AND column_name='captured_at') THEN
    ALTER TABLE scholarships ADD COLUMN captured_at timestamptz DEFAULT now();
  END IF;
END $$;

-- إنشاء indexes للمنح
CREATE INDEX IF NOT EXISTS ix_scholarships_source ON scholarships(source_name, captured_at DESC) WHERE source_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_scholarships_country ON scholarships(country_code) WHERE country_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_scholarships_level ON scholarships(study_level) WHERE study_level IS NOT NULL;

-- 5) RLS للجداول الجديدة
ALTER TABLE tuition_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE tuition_consensus ENABLE ROW LEVEL SECURITY;
ALTER TABLE tuition_change_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tuition_admin_read ON tuition_snapshots;
DROP POLICY IF EXISTS tuition_admin_all ON tuition_snapshots;
DROP POLICY IF EXISTS cons_admin_all ON tuition_consensus;
DROP POLICY IF EXISTS prop_admin_all ON tuition_change_proposals;

CREATE POLICY tuition_admin_read ON tuition_snapshots FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY tuition_admin_all ON tuition_snapshots FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY cons_admin_all ON tuition_consensus FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY prop_admin_all ON tuition_change_proposals FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));