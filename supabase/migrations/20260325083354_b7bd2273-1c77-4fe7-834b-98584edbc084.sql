
-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Students can manage own shortlist" ON public.student_shortlists;
DROP POLICY IF EXISTS "Students can view own shortlist" ON public.student_shortlists;

-- Create proper user-scoped policies
CREATE POLICY "Students can view own shortlist"
ON public.student_shortlists
FOR SELECT
TO authenticated
USING (auth.uid() = student_id);

CREATE POLICY "Students can manage own shortlist"
ON public.student_shortlists
FOR ALL
TO authenticated
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);
