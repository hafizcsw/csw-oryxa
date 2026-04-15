-- Add detailed scholarship fields to programs table
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS scholarship_percent_coverage INTEGER 
    CHECK (scholarship_percent_coverage BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS scholarship_amount_usd NUMERIC,
  ADD COLUMN IF NOT EXISTS scholarship_monthly_stipend_usd NUMERIC,
  ADD COLUMN IF NOT EXISTS scholarship_covers_housing BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS scholarship_covers_insurance BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS scholarship_notes TEXT;

-- Add comments for documentation
COMMENT ON COLUMN programs.scholarship_percent_coverage IS 'Scholarship coverage percentage (0-100%)';
COMMENT ON COLUMN programs.scholarship_amount_usd IS 'Fixed scholarship amount in USD';
COMMENT ON COLUMN programs.scholarship_monthly_stipend_usd IS 'Monthly stipend in USD';
COMMENT ON COLUMN programs.scholarship_covers_housing IS 'Whether scholarship includes housing';
COMMENT ON COLUMN programs.scholarship_covers_insurance IS 'Whether scholarship includes health insurance';
COMMENT ON COLUMN programs.scholarship_notes IS 'Additional scholarship notes';