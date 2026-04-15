-- Add notes column to applications table
ALTER TABLE applications ADD COLUMN IF NOT EXISTS notes text;