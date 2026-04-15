
-- Student friendships
CREATE TABLE public.student_friendships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  course_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (requester_id, recipient_id)
);

ALTER TABLE public.student_friendships ENABLE ROW LEVEL SECURITY;

-- Users see only their own friendships
CREATE POLICY "Users see own friendships"
  ON public.student_friendships FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

-- Users can send requests only as themselves
CREATE POLICY "Users send friend requests"
  ON public.student_friendships FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id AND requester_id != recipient_id);

-- Recipients can accept/reject
CREATE POLICY "Recipients update friendship status"
  ON public.student_friendships FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_id);

-- Users can delete their own friendships
CREATE POLICY "Users delete own friendships"
  ON public.student_friendships FOR DELETE
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

-- Peer messages between friends
CREATE TABLE public.student_peer_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  friendship_id UUID NOT NULL REFERENCES public.student_friendships(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.student_peer_messages ENABLE ROW LEVEL SECURITY;

-- Function to check if user is part of a friendship
CREATE OR REPLACE FUNCTION public.is_friendship_member(_user_id UUID, _friendship_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.student_friendships
    WHERE id = _friendship_id
      AND status = 'accepted'
      AND (_user_id = requester_id OR _user_id = recipient_id)
  )
$$;

-- Users read messages only in their accepted friendships
CREATE POLICY "Users read peer messages"
  ON public.student_peer_messages FOR SELECT
  TO authenticated
  USING (public.is_friendship_member(auth.uid(), friendship_id));

-- Users send messages only in accepted friendships as themselves
CREATE POLICY "Users send peer messages"
  ON public.student_peer_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_friendship_member(auth.uid(), friendship_id)
  );

-- Users update only their received messages (mark read)
CREATE POLICY "Users mark messages read"
  ON public.student_peer_messages FOR UPDATE
  TO authenticated
  USING (
    public.is_friendship_member(auth.uid(), friendship_id)
    AND sender_id != auth.uid()
  );

-- Enable realtime for peer messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_peer_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_friendships;

-- Indexes
CREATE INDEX idx_friendships_requester ON public.student_friendships(requester_id);
CREATE INDEX idx_friendships_recipient ON public.student_friendships(recipient_id);
CREATE INDEX idx_friendships_status ON public.student_friendships(status);
CREATE INDEX idx_peer_messages_friendship ON public.student_peer_messages(friendship_id);
CREATE INDEX idx_peer_messages_sender ON public.student_peer_messages(sender_id);
