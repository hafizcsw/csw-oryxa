
-- ===== Batchless RPCs for Always-On Pipeline =====

-- 1) Lock program_urls for fetch (no batch_id required)
CREATE OR REPLACE FUNCTION public.rpc_lock_program_urls_for_fetch_batchless(
  p_limit int DEFAULT 5,
  p_locked_by text DEFAULT 'runner'
)
RETURNS SETOF program_urls
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE program_urls
  SET locked_at = now(),
      locked_by = p_locked_by,
      status = 'fetching'
  WHERE id IN (
    SELECT id FROM program_urls
    WHERE status = 'pending'
      AND batch_id IS NULL
      AND (lease_expires_at IS NULL OR lease_expires_at < now())
      AND (locked_at IS NULL OR locked_at < now() - interval '5 minutes')
    ORDER BY created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;

REVOKE ALL ON FUNCTION public.rpc_lock_program_urls_for_fetch_batchless FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_lock_program_urls_for_fetch_batchless FROM anon;
REVOKE ALL ON FUNCTION public.rpc_lock_program_urls_for_fetch_batchless FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lock_program_urls_for_fetch_batchless TO service_role;

-- 2) Lock program_urls for extraction (no batch_id required)
CREATE OR REPLACE FUNCTION public.rpc_lock_urls_for_extraction_batchless(
  p_limit int DEFAULT 3,
  p_locked_by text DEFAULT 'runner'
)
RETURNS TABLE(url_id bigint, university_id uuid, url text, raw_page_id bigint, text_content text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH locked AS (
    UPDATE program_urls
    SET locked_at = now(),
        locked_by = p_locked_by,
        status = 'extracting'
    WHERE id IN (
      SELECT pu.id FROM program_urls pu
      WHERE pu.status = 'fetched'
        AND pu.batch_id IS NULL
        AND pu.raw_page_id IS NOT NULL
        AND (pu.locked_at IS NULL OR pu.locked_at < now() - interval '5 minutes')
      ORDER BY pu.created_at ASC
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  )
  SELECT l.id AS url_id,
         l.university_id,
         l.url,
         l.raw_page_id,
         rp.text_content
  FROM locked l
  LEFT JOIN raw_pages rp ON rp.id = l.raw_page_id;
$$;

REVOKE ALL ON FUNCTION public.rpc_lock_urls_for_extraction_batchless FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_lock_urls_for_extraction_batchless FROM anon;
REVOKE ALL ON FUNCTION public.rpc_lock_urls_for_extraction_batchless FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lock_urls_for_extraction_batchless TO service_role;

-- 3) Publish verified batchless drafts
CREATE OR REPLACE FUNCTION public.rpc_publish_verified_batchless(
  p_limit int DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_published int := 0;
  v_draft record;
BEGIN
  FOR v_draft IN
    SELECT id, university_id, title, degree_level, language,
           duration_months, currency, tuition_fee, extracted_json,
           source_program_url
    FROM program_draft
    WHERE status = 'verified'
      AND approval_tier = 'auto'
      AND batch_id IS NULL
    ORDER BY last_verified_at ASC NULLS LAST
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Insert into programs (upsert by source URL + university)
    INSERT INTO programs (
      university_id,
      name,
      degree_level,
      language,
      duration_months,
      currency,
      tuition_fee,
      source_url,
      is_active
    ) VALUES (
      v_draft.university_id,
      v_draft.title,
      v_draft.degree_level,
      v_draft.language,
      v_draft.duration_months,
      v_draft.currency,
      v_draft.tuition_fee,
      v_draft.source_program_url,
      true
    )
    ON CONFLICT (university_id, name, COALESCE(degree_level, ''))
    DO UPDATE SET
      language = EXCLUDED.language,
      duration_months = EXCLUDED.duration_months,
      currency = EXCLUDED.currency,
      tuition_fee = EXCLUDED.tuition_fee,
      source_url = EXCLUDED.source_url,
      updated_at = now();

    -- Mark draft as published
    UPDATE program_draft
    SET status = 'published',
        published_at = now()
    WHERE id = v_draft.id;

    v_published := v_published + 1;
  END LOOP;

  RETURN jsonb_build_object('published', v_published);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_publish_verified_batchless FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_publish_verified_batchless FROM anon;
REVOKE ALL ON FUNCTION public.rpc_publish_verified_batchless FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_publish_verified_batchless TO service_role;
