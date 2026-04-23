
-- 1) teacher_notes: replace permissive SELECT
DROP POLICY IF EXISTS "Authenticated users can read teacher notes" ON public.teacher_notes;

CREATE POLICY "Teacher reads own notes"
ON public.teacher_notes FOR SELECT TO authenticated
USING (teacher_user_id = auth.uid());

CREATE POLICY "Student reads notes about self"
ON public.teacher_notes FOR SELECT TO authenticated
USING (student_user_id = auth.uid());

CREATE POLICY "Admins read all teacher notes"
ON public.teacher_notes FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

-- 2) Storage: university-assets — block anonymous uploads
DROP POLICY IF EXISTS "Service insert university-assets" ON storage.objects;

CREATE POLICY "Admins insert university-assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'university-assets' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins update university-assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'university-assets' AND public.is_admin(auth.uid()))
WITH CHECK (bucket_id = 'university-assets' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins delete university-assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'university-assets' AND public.is_admin(auth.uid()));

-- 3) notifications: remove public read
DROP POLICY IF EXISTS notif_public_read ON public.notifications;

CREATE POLICY "Admins read all notifications"
ON public.notifications FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

-- 4) university_draft / scholarship_draft: admin-only read
DROP POLICY IF EXISTS draft_read_admin ON public.university_draft;
CREATE POLICY "Admins read university drafts"
ON public.university_draft FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS draft_read_admin3 ON public.scholarship_draft;
CREATE POLICY "Admins read scholarship drafts"
ON public.scholarship_draft FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

-- 5) Realtime authorization on realtime.messages
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can subscribe to own topic" ON realtime.messages;
CREATE POLICY "Authenticated can subscribe to own topic"
ON realtime.messages FOR SELECT TO authenticated
USING (
  realtime.topic() LIKE '%' || auth.uid()::text || '%'
);

DROP POLICY IF EXISTS "Authenticated can broadcast to own topic" ON realtime.messages;
CREATE POLICY "Authenticated can broadcast to own topic"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (
  realtime.topic() LIKE '%' || auth.uid()::text || '%'
);
