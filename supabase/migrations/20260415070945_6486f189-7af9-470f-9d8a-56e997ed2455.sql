-- Add source_hash to program_orx_signals for staleness detection
ALTER TABLE public.program_orx_signals
ADD COLUMN source_hash text;

COMMENT ON COLUMN public.program_orx_signals.source_hash IS 'Hash of the source program facts used for generation. Matches program_ai_snapshots.source_hash when generated together.';