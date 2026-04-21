
-- Reactions (multi-type) for community posts
CREATE TABLE IF NOT EXISTS public.community_post_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reaction text NOT NULL CHECK (reaction IN ('like','love','haha','wow','sad','angry','care')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

ALTER TABLE public.community_post_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reactions readable by all"
  ON public.community_post_reactions FOR SELECT USING (true);

CREATE POLICY "Users can react as themselves"
  ON public.community_post_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reaction"
  ON public.community_post_reactions FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reaction"
  ON public.community_post_reactions FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_community_post_reactions_post ON public.community_post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_community_post_reactions_user ON public.community_post_reactions(user_id);

-- Saved posts
CREATE TABLE IF NOT EXISTS public.community_post_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

ALTER TABLE public.community_post_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own saves"
  ON public.community_post_saves FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users save as self"
  ON public.community_post_saves FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users unsave own"
  ON public.community_post_saves FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_community_post_saves_user ON public.community_post_saves(user_id);

-- Shares (counter)
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS shares_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reactions_count integer NOT NULL DEFAULT 0;

-- Storage bucket for community uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('community-media', 'community-media', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "Community media public read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'community-media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users upload own community media"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'community-media' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users delete own community media"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'community-media' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
