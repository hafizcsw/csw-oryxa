
-- Create storage bucket for teacher intro videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('teacher-videos', 'teacher-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Table to track teacher intro videos
CREATE TABLE IF NOT EXISTS public.teacher_intro_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  video_path text NOT NULL,
  video_url text GENERATED ALWAYS AS (
    'https://alkhaznaqdlxygeznapt.supabase.co/storage/v1/object/public/teacher-videos/' || video_path
  ) STORED,
  title text,
  duration_seconds integer,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.teacher_intro_videos ENABLE ROW LEVEL SECURITY;

-- Teachers can manage their own video
CREATE POLICY "Teachers can view own video"
  ON public.teacher_intro_videos FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Teachers can insert own video"
  ON public.teacher_intro_videos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Teachers can update own video"
  ON public.teacher_intro_videos FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Teachers can delete own video"
  ON public.teacher_intro_videos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Public can view active videos (for languages page)
CREATE POLICY "Public can view active videos"
  ON public.teacher_intro_videos FOR SELECT
  TO anon
  USING (status = 'active');

-- Storage RLS policies for teacher-videos bucket
CREATE POLICY "Teachers can upload videos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'teacher-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Teachers can update own videos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'teacher-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Teachers can delete own videos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'teacher-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public can view teacher videos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'teacher-videos');
