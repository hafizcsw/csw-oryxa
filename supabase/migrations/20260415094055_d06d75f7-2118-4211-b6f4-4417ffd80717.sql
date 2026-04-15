
-- Fix inbox thread policy with proper UUID cast
ALTER TABLE public.university_page_inbox_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read threads" ON public.university_page_inbox_threads FOR SELECT TO authenticated USING (true);

ALTER TABLE public.university_page_inbox_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read messages" ON public.university_page_inbox_messages FOR SELECT TO authenticated USING (true);
