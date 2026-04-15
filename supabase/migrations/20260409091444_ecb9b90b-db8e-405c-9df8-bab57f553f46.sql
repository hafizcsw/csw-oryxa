
-- Thread type enum
CREATE TYPE public.comm_thread_type AS ENUM (
  'csw_support',
  'file_improvement',
  'university_public_inquiry',
  'university_qualified_inquiry',
  'application_thread',
  'teacher_student',
  'security_notice',
  'system_notice',
  'peer_message'
);

-- Thread status enum
CREATE TYPE public.comm_thread_status AS ENUM (
  'open',
  'awaiting_reply',
  'assigned',
  'closed',
  'archived'
);

-- Thread priority enum
CREATE TYPE public.comm_thread_priority AS ENUM (
  'low',
  'normal',
  'high',
  'urgent'
);

-- Participant role enum
CREATE TYPE public.comm_participant_role AS ENUM (
  'student',
  'university_staff',
  'teacher',
  'csw_staff',
  'system'
);

-- ═══════════════ THREADS ═══════════════
CREATE TABLE public.comm_threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_type public.comm_thread_type NOT NULL,
  status public.comm_thread_status NOT NULL DEFAULT 'open',
  priority public.comm_thread_priority NOT NULL DEFAULT 'normal',
  subject TEXT,
  linked_entity_type TEXT,
  linked_entity_id TEXT,
  university_id UUID REFERENCES public.universities(id) ON DELETE SET NULL,
  assigned_to UUID,
  created_by UUID NOT NULL,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comm_threads_created_by ON public.comm_threads(created_by);
CREATE INDEX idx_comm_threads_university_id ON public.comm_threads(university_id);
CREATE INDEX idx_comm_threads_type ON public.comm_threads(thread_type);
CREATE INDEX idx_comm_threads_status ON public.comm_threads(status);
CREATE INDEX idx_comm_threads_updated ON public.comm_threads(updated_at DESC);

-- ═══════════════ PARTICIPANTS ═══════════════
CREATE TABLE public.comm_thread_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.comm_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.comm_participant_role NOT NULL DEFAULT 'student',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ,
  UNIQUE(thread_id, user_id)
);

CREATE INDEX idx_comm_participants_user ON public.comm_thread_participants(user_id);
CREATE INDEX idx_comm_participants_thread ON public.comm_thread_participants(thread_id);

-- ═══════════════ MESSAGES ═══════════════
CREATE TABLE public.comm_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.comm_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_role public.comm_participant_role NOT NULL DEFAULT 'student',
  body TEXT NOT NULL,
  attachment_url TEXT,
  attachment_name TEXT,
  attachment_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comm_messages_thread ON public.comm_messages(thread_id, created_at);
CREATE INDEX idx_comm_messages_sender ON public.comm_messages(sender_id);

-- ═══════════════ RLS ═══════════════
ALTER TABLE public.comm_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comm_thread_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comm_messages ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user is participant
CREATE OR REPLACE FUNCTION public.is_comm_participant(_user_id UUID, _thread_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.comm_thread_participants
    WHERE user_id = _user_id AND thread_id = _thread_id
  )
$$;

-- Threads: users can SELECT threads they participate in
CREATE POLICY "Users can view their threads"
  ON public.comm_threads FOR SELECT TO authenticated
  USING (public.is_comm_participant(auth.uid(), id));

-- Threads: only service role can insert/update (edge function)
CREATE POLICY "Service can manage threads"
  ON public.comm_threads FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Participants: users can see participants of their threads
CREATE POLICY "Users can view thread participants"
  ON public.comm_thread_participants FOR SELECT TO authenticated
  USING (public.is_comm_participant(auth.uid(), thread_id));

CREATE POLICY "Service can manage participants"
  ON public.comm_thread_participants FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Messages: users can read messages in their threads
CREATE POLICY "Users can view thread messages"
  ON public.comm_messages FOR SELECT TO authenticated
  USING (public.is_comm_participant(auth.uid(), thread_id));

CREATE POLICY "Service can manage messages"
  ON public.comm_messages FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Auto-update updated_at on threads
CREATE OR REPLACE FUNCTION public.update_comm_thread_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_comm_threads_updated_at
  BEFORE UPDATE ON public.comm_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_comm_thread_timestamp();

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.comm_messages;
