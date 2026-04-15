-- =============================================
-- ATOMIC INCREMENT RPCs for race-free counter updates
-- =============================================

-- 1. Atomic increment for crawl_batches.programs_discovered
CREATE OR REPLACE FUNCTION rpc_increment_batch_programs_discovered(
  p_batch_id uuid,
  p_delta integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE crawl_batches
  SET programs_discovered = COALESCE(programs_discovered, 0) + p_delta
  WHERE id = p_batch_id;
END;
$$;

-- 2. Atomic increment for crawl_batches.programs_extracted
CREATE OR REPLACE FUNCTION rpc_increment_batch_programs_extracted(
  p_batch_id uuid,
  p_delta integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE crawl_batches
  SET programs_extracted = COALESCE(programs_extracted, 0) + p_delta
  WHERE id = p_batch_id;
END;
$$;

-- 3. Atomic increment for multiple counters at once
CREATE OR REPLACE FUNCTION rpc_increment_batch_counters(
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
SET search_path = public
AS $$
BEGIN
  UPDATE crawl_batches
  SET 
    programs_discovered = COALESCE(programs_discovered, 0) + p_programs_discovered,
    programs_extracted = COALESCE(programs_extracted, 0) + p_programs_extracted,
    programs_auto_ready = COALESCE(programs_auto_ready, 0) + p_programs_auto_ready,
    programs_quick_review = COALESCE(programs_quick_review, 0) + p_programs_quick_review,
    programs_deep_review = COALESCE(programs_deep_review, 0) + p_programs_deep_review,
    programs_published = COALESCE(programs_published, 0) + p_programs_published
  WHERE id = p_batch_id;
END;
$$;

-- =============================================
-- SMART UPSERT for program_urls (conditional update)
-- Only updates non-critical fields on conflict
-- =============================================

CREATE OR REPLACE FUNCTION rpc_upsert_program_url(
  p_university_id uuid,
  p_batch_id uuid,
  p_url text,
  p_canonical_url text,
  p_url_hash text,
  p_kind text,
  p_discovered_from text
)
RETURNS TABLE(id bigint, is_new boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id bigint;
  v_existing_status text;
BEGIN
  -- Check if exists
  SELECT pu.id, pu.status INTO v_existing_id, v_existing_status
  FROM program_urls pu
  WHERE pu.university_id = p_university_id 
    AND pu.canonical_url = p_canonical_url;
  
  IF v_existing_id IS NOT NULL THEN
    -- Exists: only update non-critical fields
    -- NEVER overwrite status if it's advanced (fetched/failed)
    UPDATE program_urls pu
    SET 
      batch_id = COALESCE(p_batch_id, pu.batch_id),
      discovered_from = COALESCE(p_discovered_from, pu.discovered_from),
      kind = CASE 
        WHEN p_kind = 'unknown' THEN pu.kind
        ELSE COALESCE(p_kind, pu.kind)
      END,
      url_hash = COALESCE(p_url_hash, pu.url_hash)
      -- status, raw_page_id, locked_at, locked_by are NOT touched
    WHERE pu.id = v_existing_id;
    
    RETURN QUERY SELECT v_existing_id, false;
  ELSE
    -- New: insert
    INSERT INTO program_urls (
      university_id, batch_id, url, canonical_url, url_hash, kind, discovered_from, status
    ) VALUES (
      p_university_id, p_batch_id, p_url, p_canonical_url, p_url_hash, p_kind, p_discovered_from, 'pending'
    )
    RETURNING program_urls.id, true INTO v_existing_id;
    
    RETURN QUERY SELECT v_existing_id, true;
  END IF;
END;
$$;

-- =============================================
-- Fix is_admin function if missing (for adminGuard)
-- =============================================

CREATE OR REPLACE FUNCTION is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;