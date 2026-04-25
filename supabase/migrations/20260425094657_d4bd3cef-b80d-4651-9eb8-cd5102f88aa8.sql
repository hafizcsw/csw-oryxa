-- Order 3R — ORYXA AI provider run log
CREATE TABLE IF NOT EXISTS public.oryxa_ai_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id uuid,
  draft_id uuid,
  task_type text NOT NULL,
  provider text NOT NULL,
  provider_mode text NOT NULL,
  model text,
  input_hash text,
  output_hash text,
  status text NOT NULL,
  tokens_in integer,
  tokens_out integer,
  latency_ms integer,
  trace_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oryxa_ai_runs_student ON public.oryxa_ai_runs(student_user_id);
CREATE INDEX IF NOT EXISTS idx_oryxa_ai_runs_draft ON public.oryxa_ai_runs(draft_id);
CREATE INDEX IF NOT EXISTS idx_oryxa_ai_runs_trace ON public.oryxa_ai_runs(trace_id);
CREATE INDEX IF NOT EXISTS idx_oryxa_ai_runs_created ON public.oryxa_ai_runs(created_at DESC);

ALTER TABLE public.oryxa_ai_runs ENABLE ROW LEVEL SECURITY;

-- Student can SELECT only own runs
CREATE POLICY "students_select_own_runs"
ON public.oryxa_ai_runs
FOR SELECT
TO authenticated
USING (student_user_id IS NOT NULL AND auth.uid() = student_user_id);

-- No INSERT/UPDATE/DELETE policies → only service_role can write (it bypasses RLS).