
-- ENUMS
DO $$ BEGIN
  CREATE TYPE public.university_page_role AS ENUM (
    'full_control','page_admin','content_publisher','moderator','inbox_agent','analyst','live_community_manager'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.university_post_type AS ENUM (
    'news','announcement','scholarship','seats_available','application_deadline','event','official_update'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.university_post_status AS ENUM ('draft','pending_review','published','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.inbox_thread_status AS ENUM ('open','assigned','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.comment_mod_action AS ENUM ('hide','delete','ban_user','mute_user','restrict_user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- UNIVERSITY PAGE STAFF
CREATE TABLE public.university_page_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.university_page_role NOT NULL DEFAULT 'content_publisher',
  invited_by UUID,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(university_id, user_id)
);
ALTER TABLE public.university_page_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view own university staff" ON public.university_page_staff FOR SELECT TO authenticated
  USING (university_id IN (SELECT s.university_id FROM public.university_page_staff s WHERE s.user_id = auth.uid()));

CREATE POLICY "Admins can manage staff" ON public.university_page_staff FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.university_page_staff s WHERE s.university_id = university_page_staff.university_id AND s.user_id = auth.uid() AND s.role IN ('full_control','page_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.university_page_staff s WHERE s.university_id = university_page_staff.university_id AND s.user_id = auth.uid() AND s.role IN ('full_control','page_admin')));

CREATE INDEX idx_page_staff_university ON public.university_page_staff(university_id);
CREATE INDEX idx_page_staff_user ON public.university_page_staff(user_id);

-- UNIVERSITY POSTS
CREATE TABLE public.university_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  post_type public.university_post_type NOT NULL DEFAULT 'news',
  title TEXT,
  body TEXT NOT NULL,
  status public.university_post_status NOT NULL DEFAULT 'draft',
  pinned BOOLEAN NOT NULL DEFAULT false,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  attachments JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.university_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published posts" ON public.university_posts FOR SELECT USING (status = 'published');
CREATE POLICY "Staff can view all university posts" ON public.university_posts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.university_page_staff s WHERE s.university_id = university_posts.university_id AND s.user_id = auth.uid()));
CREATE POLICY "Publishers can manage posts" ON public.university_posts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.university_page_staff s WHERE s.university_id = university_posts.university_id AND s.user_id = auth.uid() AND s.role IN ('full_control','page_admin','content_publisher')));
CREATE POLICY "Publishers can update posts" ON public.university_posts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.university_page_staff s WHERE s.university_id = university_posts.university_id AND s.user_id = auth.uid() AND s.role IN ('full_control','page_admin','content_publisher')));
CREATE POLICY "Publishers can delete posts" ON public.university_posts FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.university_page_staff s WHERE s.university_id = university_posts.university_id AND s.user_id = auth.uid() AND s.role IN ('full_control','page_admin','content_publisher')));

CREATE INDEX idx_uni_posts_status ON public.university_posts(university_id, status);
CREATE INDEX idx_uni_posts_published ON public.university_posts(published_at DESC);
CREATE INDEX idx_uni_posts_author ON public.university_posts(author_id);

-- COMMENTS
CREATE TABLE public.university_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.university_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  parent_id UUID REFERENCES public.university_comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.university_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view visible comments" ON public.university_comments FOR SELECT
  USING (visible = true AND EXISTS (SELECT 1 FROM public.university_posts p WHERE p.id = university_comments.post_id AND p.status = 'published'));
CREATE POLICY "Staff can view all comments" ON public.university_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.university_posts p JOIN public.university_page_staff s ON s.university_id = p.university_id WHERE p.id = university_comments.post_id AND s.user_id = auth.uid()));
CREATE POLICY "Authenticated users can comment" ON public.university_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.university_posts p WHERE p.id = university_comments.post_id AND p.status = 'published'));
CREATE POLICY "Users can edit own comments" ON public.university_comments FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own comments" ON public.university_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.university_posts p JOIN public.university_page_staff s ON s.university_id = p.university_id WHERE p.id = university_comments.post_id AND s.user_id = auth.uid() AND s.role IN ('full_control','page_admin','moderator')));

CREATE INDEX idx_uni_comments_post ON public.university_comments(post_id);
CREATE INDEX idx_uni_comments_user ON public.university_comments(user_id);

-- COMMENT MODERATION
CREATE TABLE public.university_comment_moderation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.university_comments(id) ON DELETE CASCADE,
  action public.comment_mod_action NOT NULL,
  acted_by UUID NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.university_comment_moderation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view moderation log" ON public.university_comment_moderation FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.university_comments c JOIN public.university_posts p ON p.id = c.post_id JOIN public.university_page_staff s ON s.university_id = p.university_id WHERE c.id = university_comment_moderation.comment_id AND s.user_id = auth.uid() AND s.role IN ('full_control','page_admin','moderator')));
CREATE POLICY "Moderators can create moderation actions" ON public.university_comment_moderation FOR INSERT TO authenticated
  WITH CHECK (acted_by = auth.uid() AND EXISTS (SELECT 1 FROM public.university_comments c JOIN public.university_posts p ON p.id = c.post_id JOIN public.university_page_staff s ON s.university_id = p.university_id WHERE c.id = university_comment_moderation.comment_id AND s.user_id = auth.uid() AND s.role IN ('full_control','page_admin','moderator')));

CREATE INDEX idx_uni_comment_mod ON public.university_comment_moderation(comment_id);

-- INBOX THREADS
CREATE TABLE public.university_inbox_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  visitor_user_id UUID NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  status public.inbox_thread_status NOT NULL DEFAULT 'open',
  assigned_to UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.university_inbox_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inbox staff can view threads" ON public.university_inbox_threads FOR SELECT TO authenticated
  USING (visitor_user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.university_page_staff s WHERE s.university_id = university_inbox_threads.university_id AND s.user_id = auth.uid() AND s.role IN ('full_control','page_admin','inbox_agent')));
CREATE POLICY "Users can create threads" ON public.university_inbox_threads FOR INSERT TO authenticated WITH CHECK (visitor_user_id = auth.uid());
CREATE POLICY "Staff can update threads" ON public.university_inbox_threads FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.university_page_staff s WHERE s.university_id = university_inbox_threads.university_id AND s.user_id = auth.uid() AND s.role IN ('full_control','page_admin','inbox_agent')));

CREATE INDEX idx_uni_inbox_threads ON public.university_inbox_threads(university_id, status);
CREATE INDEX idx_uni_inbox_visitor ON public.university_inbox_threads(visitor_user_id);

-- INBOX MESSAGES
CREATE TABLE public.university_inbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.university_inbox_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  body TEXT NOT NULL,
  is_university_reply BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.university_inbox_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Thread participants can read messages" ON public.university_inbox_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.university_inbox_threads t WHERE t.id = university_inbox_messages.thread_id AND (t.visitor_user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.university_page_staff s WHERE s.university_id = t.university_id AND s.user_id = auth.uid() AND s.role IN ('full_control','page_admin','inbox_agent')))));
CREATE POLICY "Participants can send messages" ON public.university_inbox_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.university_inbox_threads t WHERE t.id = university_inbox_messages.thread_id AND (t.visitor_user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.university_page_staff s WHERE s.university_id = t.university_id AND s.user_id = auth.uid() AND s.role IN ('full_control','page_admin','inbox_agent')))));

CREATE INDEX idx_uni_inbox_msgs ON public.university_inbox_messages(thread_id, created_at);

-- PAGE SETTINGS
CREATE TABLE public.university_page_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT 'true'::jsonb,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(university_id, key)
);
ALTER TABLE public.university_page_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read page settings" ON public.university_page_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage settings" ON public.university_page_settings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.university_page_staff s WHERE s.university_id = university_page_settings.university_id AND s.user_id = auth.uid() AND s.role IN ('full_control','page_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.university_page_staff s WHERE s.university_id = university_page_settings.university_id AND s.user_id = auth.uid() AND s.role IN ('full_control','page_admin')));

CREATE INDEX idx_uni_page_settings ON public.university_page_settings(university_id);

-- ANALYTICS
CREATE TABLE public.university_page_analytics (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  visitor_id TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.university_page_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert analytics" ON public.university_page_analytics FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Staff can read analytics" ON public.university_page_analytics FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.university_page_staff s WHERE s.university_id = university_page_analytics.university_id AND s.user_id = auth.uid() AND s.role IN ('full_control','page_admin','analyst')));

CREATE INDEX idx_uni_analytics_type ON public.university_page_analytics(university_id, event_type);
CREATE INDEX idx_uni_analytics_created ON public.university_page_analytics(created_at DESC);

-- HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.has_page_role(_user_id UUID, _university_id UUID, _roles university_page_role[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.university_page_staff WHERE user_id = _user_id AND university_id = _university_id AND role = ANY(_roles) AND status = 'active')
$$;

CREATE OR REPLACE FUNCTION public.is_page_staff(_user_id UUID, _university_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.university_page_staff WHERE user_id = _user_id AND university_id = _university_id AND status = 'active')
$$;

-- AUTO-PROVISION on claim approval
CREATE OR REPLACE FUNCTION public.auto_provision_page_staff()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    INSERT INTO public.university_page_staff (university_id, user_id, role, status)
    VALUES (NEW.institution_id, NEW.user_id, 'full_control', 'active')
    ON CONFLICT (university_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_provision_page_staff ON public.institution_claims;
CREATE TRIGGER trg_auto_provision_page_staff AFTER UPDATE ON public.institution_claims FOR EACH ROW EXECUTE FUNCTION public.auto_provision_page_staff();

-- REALTIME
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.university_posts; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.university_inbox_messages; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- UPDATED_AT TRIGGERS
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_staff_updated_at BEFORE UPDATE ON public.university_page_staff FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_posts_updated_at BEFORE UPDATE ON public.university_posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_comments_updated_at BEFORE UPDATE ON public.university_comments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_inbox_threads_updated_at BEFORE UPDATE ON public.university_inbox_threads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
