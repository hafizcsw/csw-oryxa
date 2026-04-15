-- Create table for pending university media suggestions
CREATE TABLE IF NOT EXISTS public.university_media_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('main_image', 'logo')),
  image_url TEXT NOT NULL,
  image_data TEXT, -- base64 encoded image if generated
  quality TEXT CHECK (quality IN ('high', 'medium', 'low', 'auto')),
  width INTEGER,
  height INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_media_suggestions_university ON public.university_media_suggestions(university_id);
CREATE INDEX IF NOT EXISTS idx_media_suggestions_status ON public.university_media_suggestions(status);

-- Enable RLS
ALTER TABLE public.university_media_suggestions ENABLE ROW LEVEL SECURITY;

-- Admin can view all
CREATE POLICY "Admins can view all media suggestions" ON public.university_media_suggestions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admin can insert
CREATE POLICY "Admins can insert media suggestions" ON public.university_media_suggestions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admin can update
CREATE POLICY "Admins can update media suggestions" ON public.university_media_suggestions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_university_media_suggestions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_university_media_suggestions_updated_at
  BEFORE UPDATE ON public.university_media_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_university_media_suggestions_updated_at();