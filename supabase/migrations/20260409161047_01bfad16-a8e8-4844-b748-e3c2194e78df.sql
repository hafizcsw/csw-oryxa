
-- Post reactions table
CREATE TABLE public.university_post_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.university_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reaction_type TEXT NOT NULL DEFAULT 'like',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Indexes
CREATE INDEX idx_post_reactions_post ON public.university_post_reactions(post_id);
CREATE INDEX idx_post_reactions_user ON public.university_post_reactions(user_id);

-- RLS
ALTER TABLE public.university_post_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reactions"
  ON public.university_post_reactions FOR SELECT USING (true);

CREATE POLICY "Auth users can insert own reaction"
  ON public.university_post_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Auth users can update own reaction"
  ON public.university_post_reactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Auth users can delete own reaction"
  ON public.university_post_reactions FOR DELETE
  USING (auth.uid() = user_id);
