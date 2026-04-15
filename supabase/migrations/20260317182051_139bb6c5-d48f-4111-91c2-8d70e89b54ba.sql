
CREATE TABLE public.import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  import_type text NOT NULL DEFAULT 'csv',
  entity_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  total_rows int NOT NULL DEFAULT 0,
  valid_rows int NOT NULL DEFAULT 0,
  invalid_rows int NOT NULL DEFAULT 0,
  skipped_rows int NOT NULL DEFAULT 0,
  applied_rows int NOT NULL DEFAULT 0,
  error_details jsonb DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz
);

ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read import_logs"
  ON public.import_logs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert import_logs"
  ON public.import_logs FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update import_logs"
  ON public.import_logs FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
