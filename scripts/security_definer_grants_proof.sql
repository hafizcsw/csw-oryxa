-- Full SECURITY DEFINER inventory with effective execute grants.
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_args,
  pg_get_userbyid(p.proowner) AS owner,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_can_execute,
  array_to_string(coalesce(p.proconfig, ARRAY[]::text[]), ', ') AS function_settings
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prosecdef
  AND n.nspname IN ('public', 'auth')
ORDER BY 1, 2, 3;

-- Residual execute grants granted directly to PUBLIC should be empty.
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_args,
  acl.privilege_type,
  acl.grantee
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) AS acl
WHERE p.prosecdef
  AND n.nspname IN ('public', 'auth')
  AND acl.grantee = 0
ORDER BY 1, 2, 3;

-- Residual mutable search_path settings on SECURITY DEFINER functions should be empty.
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_args,
  array_to_string(coalesce(p.proconfig, ARRAY[]::text[]), ', ') AS function_settings
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prosecdef
  AND n.nspname IN ('public', 'auth')
  AND EXISTS (
    SELECT 1
    FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS cfg
    WHERE cfg LIKE 'search_path=%'
      AND cfg <> 'search_path=pg_catalog, public, auth, extensions'
  )
ORDER BY 1, 2, 3;
