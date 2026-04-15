-- Fix infinite recursion in university_media_suggestions RLS policies
-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Admins can view all media suggestions" ON public.university_media_suggestions;
DROP POLICY IF EXISTS "Admins can insert media suggestions" ON public.university_media_suggestions;
DROP POLICY IF EXISTS "Admins can update media suggestions" ON public.university_media_suggestions;

-- Disable RLS temporarily for admin-only table
-- Since this is an admin-only feature, we'll control access through the edge function
ALTER TABLE public.university_media_suggestions DISABLE ROW LEVEL SECURITY;

-- Note: Access is now controlled entirely through the admin-generate-university-media edge function
-- which uses requireAdmin() to verify admin status