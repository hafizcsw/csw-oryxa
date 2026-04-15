-- Enable RLS on harvest_logs
ALTER TABLE public.harvest_logs ENABLE ROW LEVEL SECURITY;

-- Drop any existing public policies
DROP POLICY IF EXISTS "Anyone can read harvest_logs" ON public.harvest_logs;
DROP POLICY IF EXISTS "Anyone can insert harvest_logs" ON public.harvest_logs;

-- Only admins can read logs
CREATE POLICY "Admins can read harvest_logs"
ON public.harvest_logs
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can insert logs
CREATE POLICY "Admins can insert harvest_logs"
ON public.harvest_logs
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can manage all logs
CREATE POLICY "Admins full access to harvest_logs"
ON public.harvest_logs
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));