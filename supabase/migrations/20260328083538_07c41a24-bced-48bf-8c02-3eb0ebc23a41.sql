
-- User presence tracking table
CREATE TABLE public.user_presence (
  user_id UUID PRIMARY KEY,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_online BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read presence
CREATE POLICY "Authenticated users can read presence"
ON public.user_presence
FOR SELECT
TO authenticated
USING (true);

-- Users can upsert their own presence
CREATE POLICY "Users can upsert own presence"
ON public.user_presence
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own presence"
ON public.user_presence
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Enable realtime for presence
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
