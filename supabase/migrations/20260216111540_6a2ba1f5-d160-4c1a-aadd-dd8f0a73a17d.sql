-- Add pagination tracking columns to universities
ALTER TABLE public.universities 
  ADD COLUMN IF NOT EXISTS uniranks_program_pages_total integer,
  ADD COLUMN IF NOT EXISTS uniranks_program_pages_done integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS uniranks_last_trace_id text;