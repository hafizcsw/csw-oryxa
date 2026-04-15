-- Patch 21: Quality Gate + E2E Safeguards
-- Non-destructive: adds data quality tracking and gates

-- Data quality rules table
CREATE TABLE IF NOT EXISTS public.data_quality_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key TEXT NOT NULL UNIQUE,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('coverage', 'freshness', 'accuracy', 'completeness')),
  threshold NUMERIC NOT NULL DEFAULT 80,
  weight NUMERIC NOT NULL DEFAULT 1.0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Data quality snapshots table
CREATE TABLE IF NOT EXISTS public.data_quality_snapshots (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('country', 'university', 'program', 'global')),
  entity_id TEXT,
  score NUMERIC NOT NULL CHECK (score >= 0 AND score <= 100),
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  rules_passed INT NOT NULL DEFAULT 0,
  rules_failed INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quality_snapshots_entity ON public.data_quality_snapshots(entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_quality_snapshots_score ON public.data_quality_snapshots(score, created_at);

-- RLS for data quality tables
ALTER TABLE public.data_quality_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_quality_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage quality rules"
  ON public.data_quality_rules FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can view quality snapshots"
  ON public.data_quality_snapshots FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "System can insert quality snapshots"
  ON public.data_quality_snapshots FOR INSERT
  WITH CHECK (true);

-- Insert default quality rules
INSERT INTO public.data_quality_rules (rule_key, rule_name, rule_type, threshold, weight) VALUES
  ('fees_freshness', 'Fee data updated within 90 days', 'freshness', 80, 1.5),
  ('fees_coverage', 'At least 70% programs have fee data', 'coverage', 70, 1.2),
  ('admissions_freshness', 'Admission data updated within 180 days', 'freshness', 75, 1.0),
  ('admissions_coverage', 'At least 60% programs have admission data', 'coverage', 60, 1.0),
  ('official_sources', 'At least 80% data from official sources', 'accuracy', 80, 2.0),
  ('programs_active', 'At least 50% programs are active', 'completeness', 50, 1.0),
  ('scholarships_coverage', 'At least 30% universities have scholarships', 'coverage', 30, 0.8)
ON CONFLICT (rule_key) DO NOTHING;

-- Function to calculate quality score for a country
CREATE OR REPLACE FUNCTION calculate_country_quality_score(p_country_code TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_score NUMERIC := 0;
  v_total_weight NUMERIC := 0;
  v_rule RECORD;
  v_metric NUMERIC;
  v_universities_count INT;
  v_programs_count INT;
BEGIN
  -- Get counts
  SELECT COUNT(*) INTO v_universities_count
  FROM universities u
  JOIN countries c ON c.id = u.country_id
  WHERE c.slug = p_country_code AND COALESCE(u.is_active, true);
  
  SELECT COUNT(*) INTO v_programs_count
  FROM programs p
  JOIN universities u ON u.id = p.university_id
  JOIN countries c ON c.id = u.country_id
  WHERE c.slug = p_country_code AND COALESCE(p.is_active, true);
  
  IF v_universities_count = 0 OR v_programs_count = 0 THEN
    RETURN 0;
  END IF;
  
  -- Calculate score based on rules
  FOR v_rule IN SELECT * FROM data_quality_rules WHERE enabled = true LOOP
    v_metric := CASE
      WHEN v_rule.rule_key = 'fees_freshness' THEN (
        SELECT 100.0 * COUNT(*)::NUMERIC / GREATEST(v_programs_count, 1)
        FROM price_observations po
        WHERE po.observed_at > now() - interval '90 days'
      )
      WHEN v_rule.rule_key = 'fees_coverage' THEN (
        SELECT 100.0 * COUNT(DISTINCT po.program_id)::NUMERIC / GREATEST(v_programs_count, 1)
        FROM price_observations po
      )
      WHEN v_rule.rule_key = 'admissions_freshness' THEN (
        SELECT 100.0 * COUNT(*)::NUMERIC / GREATEST(v_programs_count, 1)
        FROM admissions_observations ao
        WHERE ao.observed_at > now() - interval '180 days'
      )
      WHEN v_rule.rule_key = 'admissions_coverage' THEN (
        SELECT 100.0 * COUNT(DISTINCT ao.program_id)::NUMERIC / GREATEST(v_programs_count, 1)
        FROM admissions_observations ao
      )
      WHEN v_rule.rule_key = 'programs_active' THEN (
        SELECT 100.0 * COUNT(*)::NUMERIC / GREATEST(v_programs_count, 1)
        FROM programs p
        WHERE COALESCE(p.is_active, true)
      )
      ELSE 50.0  -- Default neutral score
    END;
    
    -- Normalize to 0-1 and apply weight
    v_score := v_score + LEAST(v_metric / 100.0, 1.0) * v_rule.weight;
    v_total_weight := v_total_weight + v_rule.weight;
  END LOOP;
  
  -- Normalize to 0-100
  IF v_total_weight > 0 THEN
    RETURN ROUND((v_score / v_total_weight) * 100, 2);
  ELSE
    RETURN 0;
  END IF;
END;
$$;