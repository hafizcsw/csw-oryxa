
-- Teacher public profiles: editable by teachers, readable by public when published
CREATE TABLE public.teacher_public_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  display_name text,
  bio text,
  teaching_experience text,
  education text,
  specialty text,
  languages_spoken text[] DEFAULT '{}',
  country text,
  country_code text,
  price_per_lesson numeric,
  lesson_duration_minutes int DEFAULT 50,
  is_published boolean DEFAULT false,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.teacher_public_profiles ENABLE ROW LEVEL SECURITY;

-- Teachers can read their own profile
CREATE POLICY "tpp_own_select" ON public.teacher_public_profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Teachers can insert their own profile
CREATE POLICY "tpp_own_insert" ON public.teacher_public_profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Teachers can update their own profile
CREATE POLICY "tpp_own_update" ON public.teacher_public_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Public can read published profiles
CREATE POLICY "tpp_public_read" ON public.teacher_public_profiles
  FOR SELECT TO anon
  USING (is_published = true);

-- Authenticated users can also read published profiles (students)
CREATE POLICY "tpp_published_read" ON public.teacher_public_profiles
  FOR SELECT TO authenticated
  USING (is_published = true);
