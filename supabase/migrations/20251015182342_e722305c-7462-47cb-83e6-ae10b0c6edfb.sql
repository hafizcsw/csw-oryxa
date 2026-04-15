-- Fix permissions for university search views
-- Grant SELECT on all related views to anon and authenticated roles

GRANT SELECT ON vw_university_search TO anon, authenticated;
GRANT SELECT ON vw_university_search_ext TO anon, authenticated;
GRANT SELECT ON vw_university_program_signals TO anon, authenticated;

-- Ensure universities table has public read policy
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'universities' 
    AND policyname = 'universities_public_read'
  ) THEN
    CREATE POLICY "universities_public_read" 
    ON universities 
    FOR SELECT 
    TO anon, authenticated
    USING (true);
  END IF;
END $$;