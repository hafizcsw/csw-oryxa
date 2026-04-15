-- Add auto-approval columns to harvest_review_queue
ALTER TABLE harvest_review_queue
  ADD COLUMN IF NOT EXISTS auto_approved BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_approved_log TEXT;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_harvest_review_auto_approved 
  ON harvest_review_queue(auto_approved, verified, ai_recommendation)
  WHERE verified = false;