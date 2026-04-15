
-- Add seats/capacity columns to programs
ALTER TABLE public.programs 
  ADD COLUMN IF NOT EXISTS seats_total integer,
  ADD COLUMN IF NOT EXISTS seats_available integer,
  ADD COLUMN IF NOT EXISTS seats_status text DEFAULT 'open';
