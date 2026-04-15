
DROP POLICY IF EXISTS "Service role full access" ON public.web_chat_sessions;

CREATE POLICY "Service role full access"
ON public.web_chat_sessions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
