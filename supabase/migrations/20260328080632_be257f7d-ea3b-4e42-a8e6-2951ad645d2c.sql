
-- Conversations table for 1:1 DMs between students and teachers
CREATE TABLE public.dm_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID NOT NULL,
  teacher_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  student_unread_count INT NOT NULL DEFAULT 0,
  teacher_unread_count INT NOT NULL DEFAULT 0,
  UNIQUE (student_user_id, teacher_user_id)
);

-- Messages table
CREATE TABLE public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL,
  content TEXT,
  attachment_url TEXT,
  attachment_name TEXT,
  attachment_type TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_dm_conversations_student ON public.dm_conversations(student_user_id);
CREATE INDEX idx_dm_conversations_teacher ON public.dm_conversations(teacher_user_id);
CREATE INDEX idx_direct_messages_conversation ON public.direct_messages(conversation_id, created_at DESC);
CREATE INDEX idx_direct_messages_sender ON public.direct_messages(sender_user_id);

-- RLS
ALTER TABLE public.dm_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Conversations: participants can see their own conversations
CREATE POLICY "Users can view own conversations"
  ON public.dm_conversations FOR SELECT TO authenticated
  USING (auth.uid() = student_user_id OR auth.uid() = teacher_user_id);

CREATE POLICY "Users can insert conversations"
  ON public.dm_conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_user_id OR auth.uid() = teacher_user_id);

CREATE POLICY "Users can update own conversations"
  ON public.dm_conversations FOR UPDATE TO authenticated
  USING (auth.uid() = student_user_id OR auth.uid() = teacher_user_id);

-- Messages: participants of conversation can see/send messages
CREATE POLICY "Participants can view messages"
  ON public.direct_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dm_conversations c
      WHERE c.id = conversation_id
      AND (c.student_user_id = auth.uid() OR c.teacher_user_id = auth.uid())
    )
  );

CREATE POLICY "Participants can send messages"
  ON public.direct_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_user_id
    AND EXISTS (
      SELECT 1 FROM public.dm_conversations c
      WHERE c.id = conversation_id
      AND (c.student_user_id = auth.uid() OR c.teacher_user_id = auth.uid())
    )
  );

CREATE POLICY "Participants can update messages"
  ON public.direct_messages FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dm_conversations c
      WHERE c.id = conversation_id
      AND (c.student_user_id = auth.uid() OR c.teacher_user_id = auth.uid())
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_conversations;
