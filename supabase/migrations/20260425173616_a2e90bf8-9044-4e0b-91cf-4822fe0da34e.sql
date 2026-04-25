-- =========================================================
-- SOCIAL MEDIA PHASE 1 — Foundation (Posts/Likes/Comments/Follows)
-- =========================================================

-- 1) POSTS
CREATE TABLE IF NOT EXISTS public.social_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID NOT NULL,
  content TEXT,
  media_urls TEXT[] NOT NULL DEFAULT '{}',
  post_type TEXT NOT NULL DEFAULT 'standard' CHECK (post_type IN ('standard','short','announcement')),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','followers')),
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT social_posts_content_or_media CHECK (
    (content IS NOT NULL AND length(trim(content)) > 0) OR array_length(media_urls,1) > 0
  ),
  CONSTRAINT social_posts_content_max CHECK (content IS NULL OR length(content) <= 2000),
  CONSTRAINT social_posts_media_max CHECK (array_length(media_urls,1) IS NULL OR array_length(media_urls,1) <= 4)
);

CREATE INDEX IF NOT EXISTS idx_social_posts_created_at ON public.social_posts (created_at DESC) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_social_posts_author ON public.social_posts (author_id, created_at DESC) WHERE is_deleted = false;

-- 2) LIKES
CREATE TABLE IF NOT EXISTS public.social_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_social_likes_post ON public.social_likes (post_id);
CREATE INDEX IF NOT EXISTS idx_social_likes_user ON public.social_likes (user_id);

-- 3) COMMENTS
CREATE TABLE IF NOT EXISTS public.social_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  parent_comment_id UUID REFERENCES public.social_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(trim(content)) > 0 AND length(content) <= 1000),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_social_comments_post ON public.social_comments (post_id, created_at DESC) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_social_comments_author ON public.social_comments (author_id);

-- 4) FOLLOWS
CREATE TABLE IF NOT EXISTS public.social_follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL,
  following_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE INDEX IF NOT EXISTS idx_social_follows_follower ON public.social_follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_social_follows_following ON public.social_follows (following_id);

-- =========================================================
-- ENABLE RLS
-- =========================================================
ALTER TABLE public.social_posts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_likes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_follows  ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- RLS POLICIES — POSTS
-- =========================================================
CREATE POLICY "social_posts_public_read"
  ON public.social_posts FOR SELECT
  USING (is_deleted = false AND visibility = 'public');

CREATE POLICY "social_posts_author_read_all"
  ON public.social_posts FOR SELECT
  TO authenticated
  USING (auth.uid() = author_id);

CREATE POLICY "social_posts_insert_own"
  ON public.social_posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "social_posts_update_own"
  ON public.social_posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "social_posts_delete_own"
  ON public.social_posts FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

-- =========================================================
-- RLS POLICIES — LIKES
-- =========================================================
CREATE POLICY "social_likes_public_read"
  ON public.social_likes FOR SELECT
  USING (true);

CREATE POLICY "social_likes_insert_own"
  ON public.social_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "social_likes_delete_own"
  ON public.social_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- =========================================================
-- RLS POLICIES — COMMENTS
-- =========================================================
CREATE POLICY "social_comments_public_read"
  ON public.social_comments FOR SELECT
  USING (is_deleted = false);

CREATE POLICY "social_comments_insert_own"
  ON public.social_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "social_comments_update_own"
  ON public.social_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "social_comments_delete_own"
  ON public.social_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

-- =========================================================
-- RLS POLICIES — FOLLOWS
-- =========================================================
CREATE POLICY "social_follows_public_read"
  ON public.social_follows FOR SELECT
  USING (true);

CREATE POLICY "social_follows_insert_own"
  ON public.social_follows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "social_follows_delete_own"
  ON public.social_follows FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id);

-- =========================================================
-- TRIGGERS — counters & updated_at
-- =========================================================
CREATE OR REPLACE FUNCTION public.social_update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;$$;

DROP TRIGGER IF EXISTS trg_social_posts_updated_at ON public.social_posts;
CREATE TRIGGER trg_social_posts_updated_at
  BEFORE UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.social_update_updated_at();

DROP TRIGGER IF EXISTS trg_social_comments_updated_at ON public.social_comments;
CREATE TRIGGER trg_social_comments_updated_at
  BEFORE UPDATE ON public.social_comments
  FOR EACH ROW EXECUTE FUNCTION public.social_update_updated_at();

-- Likes counter
CREATE OR REPLACE FUNCTION public.social_likes_count_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.social_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.social_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;$$;

DROP TRIGGER IF EXISTS trg_social_likes_count ON public.social_likes;
CREATE TRIGGER trg_social_likes_count
  AFTER INSERT OR DELETE ON public.social_likes
  FOR EACH ROW EXECUTE FUNCTION public.social_likes_count_trigger();

-- Comments counter
CREATE OR REPLACE FUNCTION public.social_comments_count_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.social_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.social_posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND OLD.is_deleted = false AND NEW.is_deleted = true THEN
    UPDATE public.social_posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = NEW.post_id;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_social_comments_count ON public.social_comments;
CREATE TRIGGER trg_social_comments_count
  AFTER INSERT OR DELETE OR UPDATE OF is_deleted ON public.social_comments
  FOR EACH ROW EXECUTE FUNCTION public.social_comments_count_trigger();

-- =========================================================
-- STORAGE BUCKET
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('social-media', 'social-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "social_media_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'social-media');

CREATE POLICY "social_media_authenticated_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'social-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "social_media_owner_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'social-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "social_media_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'social-media' AND auth.uid()::text = (storage.foldername(name))[1]);
