
-- Fix infinite recursion in university_page_staff RLS policies
-- by using a security definer function to check staff membership

CREATE OR REPLACE FUNCTION public.is_university_staff(_university_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.university_page_staff
    WHERE university_id = _university_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_university_admin(_university_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.university_page_staff
    WHERE university_id = _university_id
      AND user_id = _user_id
      AND role = ANY(ARRAY['full_control'::university_page_role, 'page_admin'::university_page_role])
  )
$$;

-- Drop old recursive policies on university_page_staff
DROP POLICY IF EXISTS "Staff can view own university staff" ON public.university_page_staff;
DROP POLICY IF EXISTS "Admins can manage staff" ON public.university_page_staff;

-- Recreate without recursion
CREATE POLICY "Staff can view own university staff"
ON public.university_page_staff
FOR SELECT
USING (
  public.is_university_staff(university_id, auth.uid())
);

CREATE POLICY "Admins can manage staff"
ON public.university_page_staff
FOR ALL
USING (
  public.is_university_admin(university_id, auth.uid())
)
WITH CHECK (
  public.is_university_admin(university_id, auth.uid())
);

-- Also fix university_posts policies that reference university_page_staff directly
DROP POLICY IF EXISTS "Staff can view all university posts" ON public.university_posts;
DROP POLICY IF EXISTS "Publishers can manage posts" ON public.university_posts;
DROP POLICY IF EXISTS "Publishers can update posts" ON public.university_posts;
DROP POLICY IF EXISTS "Publishers can delete posts" ON public.university_posts;

CREATE POLICY "Staff can view all university posts"
ON public.university_posts
FOR SELECT
USING (
  public.is_university_staff(university_id, auth.uid())
);

CREATE OR REPLACE FUNCTION public.is_university_publisher(_university_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.university_page_staff
    WHERE university_id = _university_id
      AND user_id = _user_id
      AND role = ANY(ARRAY['full_control'::university_page_role, 'page_admin'::university_page_role, 'content_publisher'::university_page_role])
  )
$$;

CREATE POLICY "Publishers can manage posts"
ON public.university_posts
FOR INSERT
WITH CHECK (
  public.is_university_publisher(university_id, auth.uid())
);

CREATE POLICY "Publishers can update posts"
ON public.university_posts
FOR UPDATE
USING (
  public.is_university_publisher(university_id, auth.uid())
);

CREATE POLICY "Publishers can delete posts"
ON public.university_posts
FOR DELETE
USING (
  public.is_university_publisher(university_id, auth.uid())
);
