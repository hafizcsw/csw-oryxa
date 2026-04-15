-- Fix race conditions + add TTL-based stale lock recovery

-- 1) Atomic upsert: no pre-SELECT, preserve critical fields (status/raw_page_id/locks)
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
AS $$
  WITH up AS (
    INSERT INTO public.program_urls (
      university_id,
      batch_id,
      url,
      canonical_url,
      url_hash,
      kind,
      discovered_from,
      status
    )
    VALUES (
      p_university_id,
      p_batch_id,
      p_url,
      p_canonical_url,
      p_url_hash,
      p_kind,
      p_discovered_from,
      'pending'
    )
    ON CONFLICT (university_id, canonical_url)
    DO UPDATE
    SET
      -- SAFE fields only (do not regress the pipeline)
      batch_id = EXCLUDED.batch_id,
      url = EXCLUDED.url,
      url_hash = EXCLUDED.url_hash,
      discovered_from = EXCLUDED.discovered_from,
      kind = CASE
        WHEN EXCLUDED.kind = 'unknown' THEN public.program_urls.kind
        ELSE EXCLUDED.kind
      END
      -- DO NOT touch: status, raw_page_id, locked_at, locked_by, retry_at, fetch_error
    RETURNING public.program_urls.id, (xmax = 0) AS is_new
  )
  SELECT up.id, up.is_new FROM up;
$$;

-- 2) TTL lock recovery for program_urls (crash-safe): treat locks older than 20 minutes as stale
CREATE OR REPLACE FUNCTION public.rpc_lock_program_urls_for_fetch(
  p_batch_id uuid,
  p_limit integer,
  p_locked_by text
)
RETURNS TABLE(id bigint, url text, university_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH cte AS (
    SELECT pu.id
    FROM public.program_urls pu
    WHERE pu.batch_id = p_batch_id
      AND pu.status IN ('pending', 'retry')
      AND (pu.retry_at IS NULL OR pu.retry_at <= NOW())
      AND (pu.locked_at IS NULL OR pu.locked_at < NOW() - INTERVAL '20 minutes')
    ORDER BY pu.id
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE public.program_urls pu
  SET locked_at = NOW(),
      locked_by = p_locked_by
  FROM cte
  WHERE pu.id = cte.id
  RETURNING pu.id, pu.url, pu.university_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_lock_urls_for_extraction(
  p_batch_id uuid,
  p_limit integer
)
RETURNS TABLE(url_id bigint, url text, university_id uuid, raw_page_id bigint, text_content text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH cte AS (
    SELECT pu.id
    FROM public.program_urls pu
    WHERE pu.batch_id = p_batch_id
      AND pu.status = 'fetched'
      AND pu.raw_page_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.program_draft pd
        WHERE pd.source_program_url = pu.url
          AND pd.university_id = pu.university_id
      )
      AND (pu.locked_at IS NULL OR pu.locked_at < NOW() - INTERVAL '20 minutes')
    ORDER BY pu.id
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE public.program_urls pu
  SET locked_at = NOW(),
      locked_by = 'extract-worker'
  FROM cte
  WHERE pu.id = cte.id
  RETURNING pu.id,
            pu.url,
            pu.university_id,
            pu.raw_page_id,
            (SELECT rp.text_content FROM public.raw_pages rp WHERE rp.id = pu.raw_page_id);
END;
$function$;

-- 3) Counter RPCs: fail fast if batch is missing (helps QA + prevents silent no-ops)
CREATE OR REPLACE FUNCTION public.rpc_increment_batch_programs_extracted(
  p_batch_id uuid,
  p_delta integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rows integer;
BEGIN
  UPDATE public.crawl_batches
  SET programs_extracted = COALESCE(programs_extracted, 0) + p_delta
  WHERE id = p_batch_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'BATCH_NOT_FOUND';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_increment_batch_programs_discovered(
  p_batch_id uuid,
  p_delta integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rows integer;
BEGIN
  UPDATE public.crawl_batches
  SET programs_discovered = COALESCE(programs_discovered, 0) + p_delta
  WHERE id = p_batch_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'BATCH_NOT_FOUND';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_increment_batch_counters(
  p_batch_id uuid,
  p_programs_discovered integer DEFAULT 0,
  p_programs_extracted integer DEFAULT 0,
  p_programs_auto_ready integer DEFAULT 0,
  p_programs_quick_review integer DEFAULT 0,
  p_programs_deep_review integer DEFAULT 0,
  p_programs_published integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rows integer;
BEGIN
  UPDATE public.crawl_batches
  SET
    programs_discovered = COALESCE(programs_discovered, 0) + p_programs_discovered,
    programs_extracted  = COALESCE(programs_extracted, 0) + p_programs_extracted,
    programs_auto_ready = COALESCE(programs_auto_ready, 0) + p_programs_auto_ready,
    programs_quick_review = COALESCE(programs_quick_review, 0) + p_programs_quick_review,
    programs_deep_review  = COALESCE(programs_deep_review, 0) + p_programs_deep_review,
    programs_published  = COALESCE(programs_published, 0) + p_programs_published
  WHERE id = p_batch_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'BATCH_NOT_FOUND';
  END IF;
END;
$function$;