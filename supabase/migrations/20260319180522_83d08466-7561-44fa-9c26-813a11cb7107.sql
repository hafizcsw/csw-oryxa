-- Execute promotion for Liverpool admissions observations
DO $$
DECLARE
  result jsonb;
BEGIN
  SELECT rpc_promote_program_admissions_to_draft('f394837c-6981-4900-9531-77e87191b1af'::uuid) INTO result;
  RAISE NOTICE 'Promotion result: %', result;
END;
$$;