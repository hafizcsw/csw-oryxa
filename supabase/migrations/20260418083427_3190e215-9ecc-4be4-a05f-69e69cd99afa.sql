-- Allow public (anon + authenticated) clients to insert their own analytics events.
-- This stops the flood of 403 errors on /rest/v1/events that was slowing
-- down navigation in the student portal.
CREATE POLICY "public_insert_events"
ON public.events
FOR INSERT
TO anon, authenticated
WITH CHECK (true);