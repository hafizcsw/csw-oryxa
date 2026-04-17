-- Paddle structure runs audit log
CREATE TABLE IF NOT EXISTS public.paddle_structure_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  document_id TEXT NOT NULL,
  storage_path TEXT,
  provider TEXT NOT NULL CHECK (provider IN ('paddle_self_hosted','none')),
  status TEXT NOT NULL CHECK (status IN ('ok','unavailable','error','skipped')),
  reason TEXT,
  latency_ms INTEGER,
  page_count INTEGER,
  block_count INTEGER,
  table_count INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paddle_runs_user ON public.paddle_structure_runs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_paddle_runs_doc ON public.paddle_structure_runs(document_id);

ALTER TABLE public.paddle_structure_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users select own paddle runs"
  ON public.paddle_structure_runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users insert own paddle runs"
  ON public.paddle_structure_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);
