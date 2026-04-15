-- Add new fields to scholarships table
ALTER TABLE scholarships ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE scholarships ADD COLUMN IF NOT EXISTS coverage_type TEXT CHECK (coverage_type IN ('full', 'partial'));
ALTER TABLE scholarships ADD COLUMN IF NOT EXISTS beneficiaries_count INTEGER;
ALTER TABLE scholarships ADD COLUMN IF NOT EXISTS acceptance_rate DECIMAL(5,2) CHECK (acceptance_rate >= 0 AND acceptance_rate <= 100);
ALTER TABLE scholarships ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) CHECK (rating >= 0 AND rating <= 5);

-- Add new fields to programs table
ALTER TABLE programs ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS language TEXT;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS is_accredited BOOLEAN DEFAULT true;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS has_internship BOOLEAN DEFAULT false;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS has_scholarships BOOLEAN DEFAULT false;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS employment_rate DECIMAL(5,2) CHECK (employment_rate >= 0 AND employment_rate <= 100);
ALTER TABLE programs ADD COLUMN IF NOT EXISTS avg_salary DECIMAL(12,2);
ALTER TABLE programs ADD COLUMN IF NOT EXISTS enrolled_students INTEGER;