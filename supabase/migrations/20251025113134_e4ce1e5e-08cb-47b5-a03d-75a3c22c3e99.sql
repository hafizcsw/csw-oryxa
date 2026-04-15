-- First, let's create a diagnostic view to check what tables exist
DO $$
DECLARE
  v_programs_exists boolean;
  v_universities_exists boolean;
  v_countries_exists boolean;
BEGIN
  -- Check if programs table exists
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'programs'
  ) INTO v_programs_exists;

  -- Check if universities table exists
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'universities'
  ) INTO v_universities_exists;

  -- Check if countries table exists
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'countries'
  ) INTO v_countries_exists;

  -- Log the results in events table
  INSERT INTO events(name, properties)
  VALUES ('schema_check', jsonb_build_object(
    'programs_exists', v_programs_exists,
    'universities_exists', v_universities_exists,
    'countries_exists', v_countries_exists
  ));
END $$;

-- Create stub view temporarily to prevent function failures
CREATE OR REPLACE VIEW public.vw_university_catalog AS
SELECT
  null::uuid   as university_id,
  null::text   as university_name,
  null::text   as country_iso,
  null::uuid   as program_id,
  null::text   as program_name,
  null::text   as level,
  null::text   as study_language,
  null::numeric as tuition_per_year,
  null::int    as duration_semesters,
  null::text   as intakes,
  null::text   as requirements
WHERE false;

-- Create temporary diagnostic function to list all relevant tables
CREATE OR REPLACE FUNCTION public.get_schema_info()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'tables', (
      SELECT jsonb_agg(jsonb_build_object(
        'schema', table_schema,
        'name', table_name
      ))
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND (table_name ILIKE '%program%' 
        OR table_name ILIKE '%course%' 
        OR table_name ILIKE '%degree%'
        OR table_name ILIKE '%univer%'
        OR table_name ILIKE '%countr%')
    ),
    'columns', (
      SELECT jsonb_object_agg(
        c.table_name,
        jsonb_agg(jsonb_build_object(
          'column', c.column_name,
          'type', c.data_type
        ))
      )
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
      AND (c.table_name ILIKE '%program%' 
        OR c.table_name ILIKE '%course%' 
        OR c.table_name ILIKE '%degree%'
        OR c.table_name ILIKE '%univer%'
        OR c.table_name ILIKE '%countr%')
      GROUP BY c.table_name
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;