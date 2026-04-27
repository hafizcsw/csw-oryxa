-- ============================================================
-- Order 1B: Crawler v2 Worker v0 — Atomic Claim RPC
--
-- Provides atomic FIFO claim of a queued crawler_run_item
-- using FOR UPDATE SKIP LOCKED so concurrent workers cannot
-- double-claim the same item.
--
-- Also upserts a crawler_locks row to prevent another worker
-- from picking up a different item for the same university.
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_claim_crawler_run_item(
  p_worker_id          text,
  p_run_item_id        uuid    DEFAULT NULL,
  p_lock_duration_min  integer DEFAULT 10
)
RETURNS TABLE (
  out_run_item_id  uuid,
  out_run_id       uuid,
  out_university_id uuid,
  out_website      text,
  out_target_domain text,
  out_trace_id     text,
  out_error        text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id           uuid;
  v_run_id       uuid;
  v_uni_id       uuid;
  v_website      text;
  v_domain       text;
  v_trace        text;
  v_lock_holder  text;
  v_lock_exp     timestamptz;
BEGIN
  -- ── 1. Find and row-lock a queued item ────────────────────
  IF p_run_item_id IS NOT NULL THEN
    SELECT ci.id, ci.run_id, ci.university_id, ci.website, ci.target_domain, ci.trace_id
      INTO v_id, v_run_id, v_uni_id, v_website, v_domain, v_trace
      FROM public.crawler_run_items ci
     WHERE ci.id = p_run_item_id
       AND ci.status = 'queued'
       FOR UPDATE SKIP LOCKED;
  ELSE
    SELECT ci.id, ci.run_id, ci.university_id, ci.website, ci.target_domain, ci.trace_id
      INTO v_id, v_run_id, v_uni_id, v_website, v_domain, v_trace
      FROM public.crawler_run_items ci
     WHERE ci.status = 'queued'
     ORDER BY ci.created_at ASC
       FOR UPDATE SKIP LOCKED
     LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    out_error := 'no_queued_item';
    RETURN NEXT;
    RETURN;
  END IF;

  -- ── 2. Check for an active (non-expired) lock held by another worker ─
  SELECT lock_holder, expires_at
    INTO v_lock_holder, v_lock_exp
    FROM public.crawler_locks
   WHERE resource_type = 'university'
     AND resource_id   = v_uni_id::text
     AND expires_at    > now();

  IF FOUND AND v_lock_holder <> p_worker_id THEN
    out_error := 'university_locked';
    RETURN NEXT;
    RETURN;
  END IF;

  -- ── 3. Claim: transition item to website_check ────────────
  UPDATE public.crawler_run_items
     SET status           = 'website_check',
         stage            = 'claim',
         progress_percent = 5,
         started_at       = COALESCE(started_at, now()),
         updated_at       = now()
   WHERE id = v_id;

  -- ── 4. Upsert lock ────────────────────────────────────────
  INSERT INTO public.crawler_locks
    (resource_type, resource_id, lock_holder, expires_at, lock_metadata)
  VALUES (
    'university',
    v_uni_id::text,
    p_worker_id,
    now() + (p_lock_duration_min || ' minutes')::interval,
    jsonb_build_object(
      'run_item_id', v_id,
      'run_id',      v_run_id,
      'claimed_at',  now()
    )
  )
  ON CONFLICT (resource_type, resource_id) DO UPDATE
     SET lock_holder   = EXCLUDED.lock_holder,
         acquired_at   = now(),
         expires_at    = EXCLUDED.expires_at,
         lock_metadata = EXCLUDED.lock_metadata;

  -- ── 5. Return claimed row ─────────────────────────────────
  out_run_item_id   := v_id;
  out_run_id        := v_run_id;
  out_university_id := v_uni_id;
  out_website       := v_website;
  out_target_domain := v_domain;
  out_trace_id      := v_trace;
  out_error         := NULL;
  RETURN NEXT;
END;
$$;

-- Restrict to service_role only (worker runs under service role key)
REVOKE EXECUTE ON FUNCTION public.rpc_claim_crawler_run_item FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rpc_claim_crawler_run_item TO   service_role;
