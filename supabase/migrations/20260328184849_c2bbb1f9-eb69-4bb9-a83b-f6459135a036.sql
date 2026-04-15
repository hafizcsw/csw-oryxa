-- Teacher availability: weekly recurring time slots
CREATE TABLE public.teacher_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, day_of_week, start_time)
);

ALTER TABLE public.teacher_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own availability"
  ON public.teacher_availability FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Public read availability"
  ON public.teacher_availability FOR SELECT
  TO anon
  USING (is_active = true);

-- Teacher certificates
CREATE TABLE public.teacher_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  issuer TEXT,
  year_start INTEGER,
  year_end INTEGER,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.teacher_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own certificates"
  ON public.teacher_certificates FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Public read certificates"
  ON public.teacher_certificates FOR SELECT
  TO anon
  USING (true);

-- Add timezone to teacher_public_profiles
ALTER TABLE public.teacher_public_profiles
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Dubai';

-- Seed Mohamed Amin availability
INSERT INTO public.teacher_availability (user_id, day_of_week, start_time, end_time)
SELECT 'a36ba59a-2529-422d-bc07-4e001aef2409'::uuid, d, t, t + interval '30 minutes'
FROM (VALUES (0), (1), (2), (3), (4), (5), (6)) AS days(d),
     (VALUES ('08:00'::time), ('08:30'::time), ('09:00'::time), ('09:30'::time),
             ('10:00'::time), ('10:30'::time), ('13:30'::time), ('14:30'::time),
             ('15:00'::time), ('15:30'::time), ('16:00'::time), ('16:30'::time)) AS times(t)
WHERE NOT (d IN (5, 6) AND t >= '14:00'::time)
ON CONFLICT DO NOTHING;

-- Seed certificate
INSERT INTO public.teacher_certificates (user_id, title, issuer, year_start, year_end, is_verified)
VALUES ('a36ba59a-2529-422d-bc07-4e001aef2409', 'Preply Language Teaching Certificate', 'Preply Language Teaching Certificate', 2026, 2026, true);