DROP POLICY IF EXISTS "allow_insert_universities" ON storage.objects;
DROP POLICY IF EXISTS "allow_update_universities" ON storage.objects;
DROP POLICY IF EXISTS "allow_delete_universities" ON storage.objects;

CREATE POLICY "Admins can upload university images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'universities' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can update university images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'universities' AND public.is_admin(auth.uid()))
WITH CHECK (bucket_id = 'universities' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete university images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'universities' AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "reco_cache_public_read" ON public.recommendations_cache;

CREATE POLICY "Users read own recommendations"
ON public.recommendations_cache FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Auth read university_page_members" ON public.university_page_members;
DROP POLICY IF EXISTS "Auth read university_page_roles" ON public.university_page_roles;

CREATE POLICY "Members read own university members"
ON public.university_page_members FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.university_page_members m2
    WHERE m2.university_id = university_page_members.university_id
      AND m2.user_id = auth.uid()
  )
);

CREATE POLICY "Members read role lookup"
ON public.university_page_roles FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.university_page_members m
    WHERE m.user_id = auth.uid()
  )
);