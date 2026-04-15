
CREATE TABLE public.teacher_state_cache (
  portal_auth_user_id UUID NOT NULL PRIMARY KEY,
  crm_staff_id TEXT,
  role TEXT NOT NULL DEFAULT 'teacher',
  access_scope TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  approval_status TEXT,
  identity_verified BOOLEAN NOT NULL DEFAULT false,
  education_verified BOOLEAN NOT NULL DEFAULT false,
  can_teach BOOLEAN NOT NULL DEFAULT false,
  blockers JSONB NOT NULL DEFAULT '[]'::jsonb,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  reviewer_notes TEXT,
  rejection_reason TEXT,
  more_info_reason TEXT,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  source_version TEXT
);

ALTER TABLE public.teacher_state_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on teacher_state_cache"
  ON public.teacher_state_cache
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can read own teacher state"
  ON public.teacher_state_cache
  FOR SELECT TO authenticated
  USING (portal_auth_user_id = auth.uid());
