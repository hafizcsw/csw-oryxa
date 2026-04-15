
-- ============================================================
-- FIX: Enable RLS and add policies for tables missing them
-- ============================================================

-- 1. program_quarantine - RLS disabled (CRITICAL)
ALTER TABLE public.program_quarantine ENABLE ROW LEVEL SECURITY;

-- Admin-only access for quarantine table (internal admin table)
CREATE POLICY "Admin read access to program_quarantine"
ON public.program_quarantine FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admin insert access to program_quarantine"
ON public.program_quarantine FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admin delete access to program_quarantine"
ON public.program_quarantine FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- 2. admission_rules_country - RLS enabled but no policies
-- Public read (lookup table), admin write
CREATE POLICY "Public read access to admission_rules_country"
ON public.admission_rules_country FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admin write access to admission_rules_country"
ON public.admission_rules_country FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- 3. admission_rules_program - RLS enabled but no policies
CREATE POLICY "Public read access to admission_rules_program"
ON public.admission_rules_program FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admin write access to admission_rules_program"
ON public.admission_rules_program FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- 4. admission_rules_university - RLS enabled but no policies
CREATE POLICY "Public read access to admission_rules_university"
ON public.admission_rules_university FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admin write access to admission_rules_university"
ON public.admission_rules_university FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- 5. notarized_ledger - RLS enabled but no policies (sensitive - admin only)
CREATE POLICY "Admin read access to notarized_ledger"
ON public.notarized_ledger FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admin insert access to notarized_ledger"
ON public.notarized_ledger FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- 6. notarized_payment_provider_events - RLS enabled but no policies (sensitive - admin only)
CREATE POLICY "Admin read access to notarized_payment_provider_events"
ON public.notarized_payment_provider_events FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admin insert access to notarized_payment_provider_events"
ON public.notarized_payment_provider_events FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- 7. notarized_translation_notifications - RLS enabled but no policies
CREATE POLICY "Admin read access to notarized_translation_notifications"
ON public.notarized_translation_notifications FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admin write access to notarized_translation_notifications"
ON public.notarized_translation_notifications FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- 8. notarized_translation_queue - RLS enabled but no policies
CREATE POLICY "Admin read access to notarized_translation_queue"
ON public.notarized_translation_queue FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admin write access to notarized_translation_queue"
ON public.notarized_translation_queue FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- 9. requirement_catalog - RLS enabled but no policies (public lookup table)
CREATE POLICY "Public read access to requirement_catalog"
ON public.requirement_catalog FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admin write access to requirement_catalog"
ON public.requirement_catalog FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
