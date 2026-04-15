BEGIN;

-- Tighten overly-broad import_logs RLS policies.
DROP POLICY IF EXISTS "Authenticated users can read import_logs" ON public.import_logs;
DROP POLICY IF EXISTS "Authenticated users can insert import_logs" ON public.import_logs;
DROP POLICY IF EXISTS "Authenticated users can update import_logs" ON public.import_logs;

CREATE POLICY "import_logs_select_owner_admin"
  ON public.import_logs
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_admin(auth.uid())
    OR coalesce(auth.jwt() ->> 'role', '') = 'service_role'
  );

CREATE POLICY "import_logs_insert_owner_admin"
  ON public.import_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    OR public.is_admin(auth.uid())
    OR coalesce(auth.jwt() ->> 'role', '') = 'service_role'
  );

CREATE POLICY "import_logs_update_admin_only"
  ON public.import_logs
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR coalesce(auth.jwt() ->> 'role', '') = 'service_role'
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR coalesce(auth.jwt() ->> 'role', '') = 'service_role'
  );

-- Harden SECURITY DEFINER functions globally without changing product behavior.
DO $$
DECLARE
  fn record;
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
         FROM unnest(fn.proconfig) AS setting
         WHERE setting LIKE 'search_path=%'
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
