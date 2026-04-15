
-- Teacher availability rules: recurring weekly patterns (rules-first model)
CREATE TABLE IF NOT EXISTS public.teacher_availability_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Teacher availability exceptions: one-off overrides or blackouts
CREATE TABLE IF NOT EXISTS public.teacher_availability_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  exception_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  exception_type TEXT NOT NULL DEFAULT 'blackout' CHECK (exception_type IN ('blackout', 'override_available', 'override_unavailable')),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Teacher availability preferences: timezone, buffers, session presets
CREATE TABLE IF NOT EXISTS public.teacher_availability_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'Asia/Dubai',
  default_session_duration INTEGER NOT NULL DEFAULT 50,
  buffer_before_minutes INTEGER NOT NULL DEFAULT 5,
  buffer_after_minutes INTEGER NOT NULL DEFAULT 10,
  public_booking_enabled BOOLEAN NOT NULL DEFAULT true,
  session_duration_presets INTEGER[] NOT NULL DEFAULT '{30,45,50,60,90}',
  max_sessions_per_day INTEGER DEFAULT 8,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.teacher_availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_availability_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_availability_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own rules" ON public.teacher_availability_rules FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Public read rules" ON public.teacher_availability_rules FOR SELECT TO anon USING (is_active = true);

CREATE POLICY "Teachers manage own exceptions" ON public.teacher_availability_exceptions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Public read exceptions" ON public.teacher_availability_exceptions FOR SELECT TO anon USING (true);

CREATE POLICY "Teachers manage own preferences" ON public.teacher_availability_preferences FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Public read preferences" ON public.teacher_availability_preferences FOR SELECT TO anon USING (public_booking_enabled = true);

-- Migrate existing teacher_availability data into new rules table
INSERT INTO public.teacher_availability_rules (user_id, day_of_week, start_time, end_time, is_active)
SELECT user_id, day_of_week, start_time::time, end_time::time, COALESCE(is_active, true)
FROM public.teacher_availability
ON CONFLICT DO NOTHING;
