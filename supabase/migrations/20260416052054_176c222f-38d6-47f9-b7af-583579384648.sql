
-- Community posts table for students and universities
CREATE TABLE public.community_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_type TEXT NOT NULL CHECK (author_type IN ('student', 'university')),
  author_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  university_id UUID REFERENCES public.universities(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT,
  tags TEXT[] DEFAULT '{}',
  likes_count INT NOT NULL DEFAULT 0,
  comments_count INT NOT NULL DEFAULT 0,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_author CHECK (
    (author_type = 'student' AND author_user_id IS NOT NULL) OR
    (author_type = 'university' AND university_id IS NOT NULL)
  )
);

-- Likes table
CREATE TABLE public.community_post_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Comments table
CREATE TABLE public.community_post_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_community_posts_author_type ON public.community_posts(author_type);
CREATE INDEX idx_community_posts_created_at ON public.community_posts(created_at DESC);
CREATE INDEX idx_community_posts_university ON public.community_posts(university_id) WHERE university_id IS NOT NULL;
CREATE INDEX idx_community_post_likes_post ON public.community_post_likes(post_id);
CREATE INDEX idx_community_post_comments_post ON public.community_post_comments(post_id);

-- Enable RLS
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_post_comments ENABLE ROW LEVEL SECURITY;

-- Posts: everyone can read
CREATE POLICY "Anyone can view community posts"
ON public.community_posts FOR SELECT
USING (true);

-- Posts: authenticated users can create their own student posts
CREATE POLICY "Students can create their own posts"
ON public.community_posts FOR INSERT
TO authenticated
WITH CHECK (author_type = 'student' AND author_user_id = auth.uid());

-- Posts: authors can update their own posts
CREATE POLICY "Authors can update their own posts"
ON public.community_posts FOR UPDATE
TO authenticated
USING (author_user_id = auth.uid());

-- Posts: authors can delete their own posts
CREATE POLICY "Authors can delete their own posts"
ON public.community_posts FOR DELETE
TO authenticated
USING (author_user_id = auth.uid());

-- Likes: everyone can view
CREATE POLICY "Anyone can view likes"
ON public.community_post_likes FOR SELECT
USING (true);

-- Likes: authenticated users can like
CREATE POLICY "Users can like posts"
ON public.community_post_likes FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Likes: users can unlike
CREATE POLICY "Users can unlike posts"
ON public.community_post_likes FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Comments: everyone can view
CREATE POLICY "Anyone can view comments"
ON public.community_post_comments FOR SELECT
USING (true);

-- Comments: authenticated users can comment
CREATE POLICY "Users can create comments"
ON public.community_post_comments FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Comments: users can delete their own comments
CREATE POLICY "Users can delete their own comments"
ON public.community_post_comments FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_community_posts_updated_at
BEFORE UPDATE ON public.community_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
