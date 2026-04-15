-- Enable RLS on chat_messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Drop any existing public policies
DROP POLICY IF EXISTS "Anyone can read chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Anyone can insert chat_messages" ON public.chat_messages;

-- Users can only read messages from their own sessions
CREATE POLICY "Users can read own session messages"
ON public.chat_messages
FOR SELECT
USING (
  session_id IN (
    SELECT id FROM public.chat_sessions 
    WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

-- Users can only insert messages to their own sessions
CREATE POLICY "Users can insert to own sessions"
ON public.chat_messages
FOR INSERT
WITH CHECK (
  session_id IN (
    SELECT id FROM public.chat_sessions 
    WHERE user_id = auth.uid()
  )
);

-- Admins can manage all messages
CREATE POLICY "Admins full access to chat_messages"
ON public.chat_messages
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));