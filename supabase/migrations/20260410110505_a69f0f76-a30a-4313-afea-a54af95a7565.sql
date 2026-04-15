
-- Helper function to check if a user is active staff of a university (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_university_page_staff(_user_id uuid, _university_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.university_page_staff
    WHERE user_id = _user_id
      AND university_id = _university_id
      AND status = 'active'
  )
$$;

-- Helper: get university_id for a program
CREATE OR REPLACE FUNCTION public.get_program_university_id(_program_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT university_id FROM public.programs WHERE id = _program_id LIMIT 1
$$;

-- ═══════════════════════════════════════
-- program_offers: drop unsafe, add ownership
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "Authenticated users can manage offers" ON public.program_offers;

CREATE POLICY "Staff can manage own university offers"
ON public.program_offers
FOR ALL
TO authenticated
USING (
  public.is_university_page_staff(auth.uid(), university_id)
)
WITH CHECK (
  public.is_university_page_staff(auth.uid(), university_id)
);

-- ═══════════════════════════════════════
-- scholarship_links: drop unsafe, add ownership
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "Authenticated can manage links" ON public.scholarship_links;

CREATE POLICY "Staff can manage own university scholarship links"
ON public.scholarship_links
FOR ALL
TO authenticated
USING (
  public.is_university_page_staff(auth.uid(), university_id)
)
WITH CHECK (
  public.is_university_page_staff(auth.uid(), university_id)
);

-- ═══════════════════════════════════════
-- program_ai_snapshots: restrict writes to service role only
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "Authenticated can manage snapshots" ON public.program_ai_snapshots;

CREATE POLICY "Staff can read own university snapshots"
ON public.program_ai_snapshots
FOR SELECT
TO authenticated
USING (
  public.is_university_page_staff(auth.uid(), public.get_program_university_id(program_id))
  OR is_current = true
);

-- ═══════════════════════════════════════
-- program_orx_signals: restrict writes to service role only
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "Authenticated can manage signals" ON public.program_orx_signals;

CREATE POLICY "Staff can read own university signals"
ON public.program_orx_signals
FOR SELECT
TO authenticated
USING (
  public.is_university_page_staff(auth.uid(), public.get_program_university_id(program_id))
  OR is_current = true
);

-- ═══════════════════════════════════════
-- program_ingestion_jobs: ownership enforcement
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "Users can create jobs" ON public.program_ingestion_jobs;
DROP POLICY IF EXISTS "Users can read own jobs" ON public.program_ingestion_jobs;
DROP POLICY IF EXISTS "Users can update own jobs" ON public.program_ingestion_jobs;

CREATE POLICY "Staff can manage own university ingestion jobs"
ON public.program_ingestion_jobs
FOR ALL
TO authenticated
USING (
  public.is_university_page_staff(auth.uid(), university_id)
)
WITH CHECK (
  public.is_university_page_staff(auth.uid(), university_id)
);

-- ═══════════════════════════════════════
-- program_ingestion_proposals: ownership enforcement
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "Authenticated can manage proposals" ON public.program_ingestion_proposals;
DROP POLICY IF EXISTS "Authenticated can read proposals" ON public.program_ingestion_proposals;

CREATE POLICY "Staff can read own university proposals"
ON public.program_ingestion_proposals
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.program_ingestion_jobs j
    WHERE j.id = job_id
      AND public.is_university_page_staff(auth.uid(), j.university_id)
  )
);

-- ═══════════════════════════════════════
-- university_program_intelligence: ownership enforcement
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "System can manage intelligence" ON public.university_program_intelligence;
DROP POLICY IF EXISTS "Authenticated can read intelligence" ON public.university_program_intelligence;

CREATE POLICY "Staff can read own university intelligence"
ON public.university_program_intelligence
FOR SELECT
TO authenticated
USING (
  public.is_university_page_staff(auth.uid(), university_id)
);
