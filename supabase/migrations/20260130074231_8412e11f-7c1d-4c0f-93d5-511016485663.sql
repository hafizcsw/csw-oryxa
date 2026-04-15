-- #7.1 FIX: Atomic LIMIT=10 + Idempotent Insert

CREATE OR REPLACE FUNCTION public.rpc_shortlist_add(p_program_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid UUID := auth.uid();
  v_exists boolean;
  v_count_before integer;
  v_inserted boolean;
  v_count_after integer;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_program_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'invalid_program_id');
  END IF;

  -- ATOMIC: Advisory lock per user prevents race conditions
  PERFORM pg_advisory_xact_lock(hashtext(uid::text));

  -- Check existence (for idempotency response)
  SELECT EXISTS(
    SELECT 1 FROM portal_shortlist
    WHERE auth_user_id = uid AND program_id = p_program_id
  ) INTO v_exists;

  -- Count current items (under lock = safe)
  SELECT COUNT(*) INTO v_count_before
  FROM portal_shortlist
  WHERE auth_user_id = uid;

  -- LIMIT ENFORCEMENT: Block NEW items when at limit
  IF v_count_before >= 10 AND NOT v_exists THEN
    RAISE LOG 'SHORTLIST_LIMIT_BLOCKED auth_user_id=% program_id=% current_count=% limit=10', uid, p_program_id, v_count_before;

    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'shortlist_limit_reached',
      'count', v_count_before,
      'limit', 10,
      'limit_reached', true,
      'items', (SELECT public.rpc_shortlist_list()->'items')
    );
  END IF;

  -- IDEMPOTENT: ON CONFLICT DO NOTHING
  INSERT INTO portal_shortlist (auth_user_id, program_id)
  VALUES (uid, p_program_id)
  ON CONFLICT (auth_user_id, program_id) DO NOTHING;

  v_inserted := FOUND;

  -- Count after insert
  SELECT COUNT(*) INTO v_count_after
  FROM portal_shortlist
  WHERE auth_user_id = uid;

  IF v_inserted THEN
    RAISE LOG 'SHORTLIST_ADDED auth_user_id=% program_id=% new_count=% limit=10', uid, p_program_id, v_count_after;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'added', v_inserted,
    'already_exists', (NOT v_inserted),
    'count', v_count_after,
    'limit', 10,
    'limit_reached', v_count_after >= 10
  );
END;
$$;