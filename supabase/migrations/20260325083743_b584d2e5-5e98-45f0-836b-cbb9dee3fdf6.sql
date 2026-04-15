
DROP POLICY IF EXISTS "Allow service role insert/update on university_geo_matches" ON public.university_geo_matches;

CREATE POLICY "Allow service role insert/update on university_geo_matches"
ON public.university_geo_matches
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
