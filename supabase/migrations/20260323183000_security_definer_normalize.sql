BEGIN;

-- Normalize every remaining SECURITY DEFINER function to a fixed, trusted
-- search_path and remove any residual PUBLIC execute grants. This keeps the
-- existing explicit role grants intact while closing the two common hosted
-- scanner findings for SECURITY DEFINER functions.
DO $$
DECLARE
  fn record;
  desired_search_path constant text := 'search_path=pg_catalog, public, auth, extensions';
BEGIN
  FOR fn IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS identity_args,
      p.proconfig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosecdef
      AND n.nspname IN ('public', 'auth')
  LOOP
    IF fn.proconfig IS NULL
       OR NOT EXISTS (
         SELECT 1
         FROM unnest(fn.proconfig) AS cfg
         WHERE cfg = desired_search_path
       )
    THEN
      EXECUTE format(
        'ALTER FUNCTION %I.%I(%s) SET search_path = pg_catalog, public, auth, extensions',
        fn.schema_name,
        fn.function_name,
        fn.identity_args
      );
    END IF;

    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  END LOOP;
END $$;

COMMIT;
