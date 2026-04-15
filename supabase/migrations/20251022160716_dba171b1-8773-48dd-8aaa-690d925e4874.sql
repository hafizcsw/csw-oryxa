-- Migration: Add display fields for university-centric design
-- Phase 1: University display enhancements
ALTER TABLE universities
  ADD COLUMN IF NOT EXISTS main_image_url TEXT,
  ADD COLUMN IF NOT EXISTS show_in_home BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 100;

-- Phase 2: Program pricing enhancements
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS old_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS gpa_required NUMERIC(3,2);

-- Add comment for clarity
COMMENT ON COLUMN universities.main_image_url IS 'Main hero image for university page';
COMMENT ON COLUMN universities.show_in_home IS 'Display university on home page';
COMMENT ON COLUMN universities.display_order IS 'Order of display on home page (lower = first)';
COMMENT ON COLUMN programs.old_price IS 'Original price before discount (for display)';
COMMENT ON COLUMN programs.gpa_required IS 'Minimum GPA required for admission';