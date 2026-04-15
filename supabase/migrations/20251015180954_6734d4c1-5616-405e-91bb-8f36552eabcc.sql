-- Grant SELECT access to vw_university_search_ext for anon users
GRANT SELECT ON vw_university_search_ext TO anon;
GRANT SELECT ON vw_university_search_ext TO authenticated;

-- Also ensure the base view has permissions
GRANT SELECT ON vw_university_search TO anon;
GRANT SELECT ON vw_university_search TO authenticated;

-- Grant permissions on vw_university_program_signals
GRANT SELECT ON vw_university_program_signals TO anon;
GRANT SELECT ON vw_university_program_signals TO authenticated;