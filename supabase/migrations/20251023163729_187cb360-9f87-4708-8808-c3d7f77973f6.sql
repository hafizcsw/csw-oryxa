-- Fix RLS policy for events table to allow inserts from authenticated users and service role
DROP POLICY IF EXISTS "Events are writable by anyone" ON public.events;

CREATE POLICY "Events are writable by authenticated users or service role" 
ON public.events 
FOR INSERT 
WITH CHECK (true);