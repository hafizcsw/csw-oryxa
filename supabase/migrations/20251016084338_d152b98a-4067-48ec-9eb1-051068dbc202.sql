-- Performance indexes for frequently filtered columns
-- Programs table
CREATE INDEX IF NOT EXISTS idx_prog_univ ON programs(university_id);
CREATE INDEX IF NOT EXISTS idx_prog_degree ON programs(degree_id);
CREATE INDEX IF NOT EXISTS idx_prog_ielts ON programs(ielts_required) WHERE ielts_required IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prog_intake ON programs(next_intake_date) WHERE next_intake_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prog_active ON programs(is_active) WHERE is_active = true;

-- Scholarships table
CREATE INDEX IF NOT EXISTS idx_sch_country ON scholarships(country_id);
CREATE INDEX IF NOT EXISTS idx_sch_degree ON scholarships(degree_id);
CREATE INDEX IF NOT EXISTS idx_sch_amount ON scholarships(amount) WHERE amount IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sch_status ON scholarships(status) WHERE status = 'published';

-- Education Events table
CREATE INDEX IF NOT EXISTS idx_evt_country ON education_events(country_id);
CREATE INDEX IF NOT EXISTS idx_evt_type ON education_events(event_type);
CREATE INDEX IF NOT EXISTS idx_evt_start ON education_events(start_at);
CREATE INDEX IF NOT EXISTS idx_evt_online ON education_events(is_online);

-- Universities table
CREATE INDEX IF NOT EXISTS idx_uni_country ON universities(country_id);
CREATE INDEX IF NOT EXISTS idx_uni_rank ON universities(ranking) WHERE ranking IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_uni_active ON universities(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_uni_fees ON universities(annual_fees) WHERE annual_fees IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_uni_living ON universities(monthly_living) WHERE monthly_living IS NOT NULL;

-- Composite indexes for common search patterns
CREATE INDEX IF NOT EXISTS idx_prog_country_degree 
  ON programs(university_id, degree_id) 
  WHERE is_active = true;

-- Data integrity constraints (using DO block for IF NOT EXISTS)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_uni_costs_nonneg') THEN
    ALTER TABLE universities
      ADD CONSTRAINT chk_uni_costs_nonneg 
      CHECK (
        (annual_fees IS NULL OR annual_fees >= 0) AND
        (monthly_living IS NULL OR monthly_living >= 0)
      ) NOT VALID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sch_amount_nonneg') THEN
    ALTER TABLE scholarships
      ADD CONSTRAINT chk_sch_amount_nonneg
      CHECK (amount IS NULL OR amount >= 0) NOT VALID;
  END IF;
END $$;