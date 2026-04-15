-- Teachers can read their own sessions
CREATE POLICY "Teachers read own sessions"
  ON public.teacher_sessions
  FOR SELECT
  TO authenticated
  USING (teacher_user_id = auth.uid());

-- Students can read sessions they are part of
CREATE POLICY "Students read own sessions"
  ON public.teacher_sessions
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT session_id FROM public.teacher_session_students
      WHERE student_user_id = auth.uid()
    )
  );

-- Teachers can read students of their own sessions
CREATE POLICY "Teachers read own session students"
  ON public.teacher_session_students
  FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM public.teacher_sessions
      WHERE teacher_user_id = auth.uid()
    )
  );

-- Students can read their own session_students entries
CREATE POLICY "Students read own session entries"
  ON public.teacher_session_students
  FOR SELECT
  TO authenticated
  USING (student_user_id = auth.uid());