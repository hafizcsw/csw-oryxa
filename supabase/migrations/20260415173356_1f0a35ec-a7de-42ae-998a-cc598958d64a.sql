-- Allow authenticated users to read admissions_consensus (public reference data)
CREATE POLICY "authenticated_read_admissions_consensus"
ON public.admissions_consensus
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to read admission_rules_program (public reference data)
CREATE POLICY "authenticated_read_admission_rules_program"
ON public.admission_rules_program
FOR SELECT
TO authenticated
USING (true);