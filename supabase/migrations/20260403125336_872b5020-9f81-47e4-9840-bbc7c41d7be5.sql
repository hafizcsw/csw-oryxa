
-- Daily streak tracking
CREATE TABLE public.learning_daily_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  activity_date date NOT NULL DEFAULT CURRENT_DATE,
  words_mastered integer NOT NULL DEFAULT 0,
  blocks_completed integer NOT NULL DEFAULT 0,
  streak_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, activity_date)
);

ALTER TABLE public.learning_daily_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own streaks" ON public.learning_daily_streaks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own streaks" ON public.learning_daily_streaks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own streaks" ON public.learning_daily_streaks
  FOR UPDATE USING (auth.uid() = user_id);

-- Block-level progress (syncs from localStorage)
CREATE TABLE public.learning_block_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lesson_slug text NOT NULL,
  block_id text NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 1,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, lesson_slug, block_id)
);

ALTER TABLE public.learning_block_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own block progress" ON public.learning_block_progress
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own block progress" ON public.learning_block_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own block progress" ON public.learning_block_progress
  FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_learning_daily_streaks_user ON public.learning_daily_streaks(user_id, activity_date DESC);
CREATE INDEX idx_learning_block_progress_user ON public.learning_block_progress(user_id, lesson_slug);
