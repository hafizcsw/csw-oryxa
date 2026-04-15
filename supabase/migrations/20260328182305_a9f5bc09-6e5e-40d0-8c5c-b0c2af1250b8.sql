
-- Session action items: teacher creates for student, student completes
CREATE TABLE public.session_action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  teacher_user_id uuid NOT NULL,
  student_user_id uuid NOT NULL,
  action_type text NOT NULL DEFAULT 'homework',
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'pending',
  due_at timestamptz,
  completed_at timestamptz,
  student_response text,
  teacher_feedback text,
  related_lesson_slug text,
  related_module_slug text,
  recap_available boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for fast lookup
CREATE INDEX idx_session_actions_student ON public.session_action_items(student_user_id, status);
CREATE INDEX idx_session_actions_teacher ON public.session_action_items(teacher_user_id, status);
CREATE INDEX idx_session_actions_session ON public.session_action_items(session_id);

-- RLS
ALTER TABLE public.session_action_items ENABLE ROW LEVEL SECURITY;

-- Students can read their own action items
CREATE POLICY "students_read_own_actions" ON public.session_action_items
  FOR SELECT TO authenticated
  USING (auth.uid() = student_user_id);

-- Students can update their own action items (to submit responses)
CREATE POLICY "students_update_own_actions" ON public.session_action_items
  FOR UPDATE TO authenticated
  USING (auth.uid() = student_user_id)
  WITH CHECK (auth.uid() = student_user_id);

-- Service role handles teacher writes via edge function
