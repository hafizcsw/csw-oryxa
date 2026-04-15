-- Phase 0/1 foundations for University Page OS lane (native-only)

CREATE TABLE IF NOT EXISTS public.page_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID REFERENCES public.universities(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.page_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all activity logs"
  ON public.page_activity_log FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Service role inserts activity logs"
  ON public.page_activity_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.page_mutation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  mutation_type TEXT NOT NULL,
  before_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  proposal_id UUID REFERENCES public.institution_page_edits(id) ON DELETE SET NULL,
  actor_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.page_mutation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read mutation history"
  ON public.page_mutation_history FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Service role inserts mutation history"
  ON public.page_mutation_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

INSERT INTO public.feature_flags(key, enabled, payload)
VALUES
  ('university_page_os_lane_enabled', true, '{"owner":"university_page_os","phase":"phase_0_1"}'::jsonb),
  ('university_page_social_enabled', true, '{"owner":"university_page_os","phase":"phase_0_1"}'::jsonb)
ON CONFLICT (key) DO NOTHING;