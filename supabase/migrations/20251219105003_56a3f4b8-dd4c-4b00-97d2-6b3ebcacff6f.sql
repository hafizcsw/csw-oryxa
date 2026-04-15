-- Fix 1: Add student self-access policies for application_documents
CREATE POLICY "application_documents_self_select"
ON application_documents FOR SELECT
USING (
  application_id IN (
    SELECT id FROM applications 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "application_documents_self_insert"
ON application_documents FOR INSERT
WITH CHECK (
  application_id IN (
    SELECT id FROM applications 
    WHERE user_id = auth.uid()
  )
);

-- Fix 2: Add student self-access policies for application_programs
CREATE POLICY "application_programs_self_select"
ON application_programs FOR SELECT
USING (
  application_id IN (
    SELECT id FROM applications 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "application_programs_self_insert"
ON application_programs FOR INSERT
WITH CHECK (
  application_id IN (
    SELECT id FROM applications 
    WHERE user_id = auth.uid()
  )
);

-- Fix 3: Replace overly permissive chat_sessions policy
DROP POLICY IF EXISTS cs_select_all ON chat_sessions;

-- Users can only see their own sessions
CREATE POLICY "chat_sessions_self_select"
ON chat_sessions FOR SELECT
USING (auth.uid() = user_id);

-- Admins can see all sessions
CREATE POLICY "chat_sessions_admin_select"
ON chat_sessions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);