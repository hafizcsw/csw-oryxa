-- Attempt to harden DEFAULT EXECUTE privileges for newly-created functions in schema public.
-- NOTE: This applies to the role executing the migration (no FOR ROLE clause).
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;

-- Enforce explicit ACLs for crawler/pipeline RPCs across ALL overloads (name + identity args).
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (
        p.proname LIKE 'rpc_lock_%'
        OR p.proname LIKE 'rpc_increment_%'
        OR p.proname IN ('rpc_upsert_program_url', 'rpc_publish_program_batch')
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC', r.nspname, r.proname, r.args);
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM anon', r.nspname, r.proname, r.args);
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM authenticated', r.nspname, r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role', r.nspname, r.proname, r.args);
  END LOOP;
END $$;

-- Fix rpc_upsert_program_url: keep atomic upsert, but DO NOT overwrite the stored 'url'
-- unless it's currently NULL/empty (canonical_url remains the conflict key).
CREATE OR REPLACE FUNCTION public.rpc_upsert_program_url(
  p_university_id uuid,
  p_batch_id uuid,
  p_url text,
  p_canonical_url text,
  p_url_hash text,
  p_kind text,
  p_discovered_from text
)
RETURNS TABLE(id bigint, is_new boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
WITH up AS (
  INSERT INTO program_urls (
    university_id, batch_id, url, canonical_url, url_hash, kind, discovered_from, status
  ) VALUES (
    p_university_id, p_batch_id, p_url, p_canonical_url, p_url_hash, p_kind, p_discovered_from, 'pending'
  )
  ON CONFLICT (university_id, canonical_url) DO UPDATE
  SET
    -- ONLY update batch_id when status allows (pending/retry)
    batch_id = CASE
      WHEN program_urls.status IN ('pending', 'retry') THEN EXCLUDED.batch_id
      ELSE program_urls.batch_id
    END,

    -- Keep original URL stable (avoid silently rewriting the "source" URL)
    url = CASE
      WHEN program_urls.url IS NULL OR program_urls.url = '' THEN EXCLUDED.url
      ELSE program_urls.url
    END,

    kind = CASE WHEN EXCLUDED.kind = 'unknown' THEN program_urls.kind ELSE EXCLUDED.kind END,
    discovered_from = EXCLUDED.discovered_from,
    url_hash = EXCLUDED.url_hash
    -- CRITICAL: Never touch status, raw_page_id, locked_at, locked_by, retry_at, fetch_error
  RETURNING program_urls.id, (xmax = 0) AS is_new
)
SELECT id, is_new FROM up;
$function$;