-- Performance Optimization: Add Indexes (Safe version)

-- Indexes for events table (6.8 MB - most queried)
CREATE INDEX IF NOT EXISTS idx_events_visitor_id ON public.events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_events_name_created ON public.events(name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON public.events(created_at DESC);

-- Indexes for universities table
CREATE INDEX IF NOT EXISTS idx_universities_country_id ON public.universities(country_id);
CREATE INDEX IF NOT EXISTS idx_universities_ranking ON public.universities(ranking);
CREATE INDEX IF NOT EXISTS idx_universities_city ON public.universities(city);

-- Indexes for programs table
CREATE INDEX IF NOT EXISTS idx_programs_university_id ON public.programs(university_id);
CREATE INDEX IF NOT EXISTS idx_programs_degree_id ON public.programs(degree_id);
CREATE INDEX IF NOT EXISTS idx_programs_tuition ON public.programs(tuition_yearly);
CREATE INDEX IF NOT EXISTS idx_programs_next_intake ON public.programs(next_intake_date);

-- Composite index for common university queries
CREATE INDEX IF NOT EXISTS idx_universities_country_ranking ON public.universities(country_id, ranking);

-- Function to clean old events (keep last 90 days)
CREATE OR REPLACE FUNCTION clean_old_events()
RETURNS void AS $$
BEGIN
  DELETE FROM public.events 
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup to run daily at 2 AM
SELECT cron.schedule(
  'clean-old-events',
  '0 2 * * *',
  'SELECT clean_old_events();'
);