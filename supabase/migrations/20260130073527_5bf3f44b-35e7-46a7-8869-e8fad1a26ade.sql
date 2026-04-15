-- ============= #7.1 SHORTLIST DATA MODEL =============
-- Table: portal_shortlist (Hearts/Favorites with LIMIT=10)

CREATE TABLE public.portal_shortlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(auth_user_id, program_id)
);

-- Index for fast lookups
CREATE INDEX idx_portal_shortlist_user ON public.portal_shortlist(auth_user_id);
CREATE INDEX idx_portal_shortlist_program ON public.portal_shortlist(program_id);

-- Enable RLS
ALTER TABLE public.portal_shortlist ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only see/manage their own shortlist
CREATE POLICY "Users can view own shortlist" 
ON public.portal_shortlist FOR SELECT 
USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can insert own shortlist" 
ON public.portal_shortlist FOR INSERT 
WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "Users can delete own shortlist" 
ON public.portal_shortlist FOR DELETE 
USING (auth.uid() = auth_user_id);

-- ============= RPC: SHORTLIST_LIST =============
CREATE OR REPLACE FUNCTION public.rpc_shortlist_list()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid UUID := auth.uid();
  v_items jsonb;
  v_count integer;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM portal_shortlist
  WHERE auth_user_id = uid;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'program_id', ps.program_id,
      'created_at', ps.created_at
    ) ORDER BY ps.created_at DESC
  ), '[]'::jsonb) INTO v_items
  FROM portal_shortlist ps
  WHERE ps.auth_user_id = uid;

  RETURN jsonb_build_object(
    'ok', true,
    'count', v_count,
    'limit', 10,
    'items', v_items
  );
END;
$$;

-- ============= RPC: SHORTLIST_ADD (LIMIT=10 ENFORCED) =============
CREATE OR REPLACE FUNCTION public.rpc_shortlist_add(p_program_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid UUID := auth.uid();
  v_current_count integer;
  v_already_exists boolean;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_program_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'invalid_program_id');
  END IF;

  -- Check if already in shortlist
  SELECT EXISTS(
    SELECT 1 FROM portal_shortlist 
    WHERE auth_user_id = uid AND program_id = p_program_id
  ) INTO v_already_exists;

  IF v_already_exists THEN
    -- Already exists, return current state
    SELECT COUNT(*) INTO v_current_count
    FROM portal_shortlist WHERE auth_user_id = uid;
    
    RETURN jsonb_build_object(
      'ok', true,
      'already_exists', true,
      'count', v_current_count,
      'limit', 10,
      'limit_reached', v_current_count >= 10
    );
  END IF;

  -- Count current items
  SELECT COUNT(*) INTO v_current_count
  FROM portal_shortlist
  WHERE auth_user_id = uid;

  -- LIMIT ENFORCEMENT: Block if >= 10
  IF v_current_count >= 10 THEN
    RAISE LOG 'SHORTLIST_LIMIT_BLOCKED auth_user_id=% program_id=% current_count=% limit=10', uid, p_program_id, v_current_count;
    
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'shortlist_limit_reached',
      'count', v_current_count,
      'limit', 10,
      'limit_reached', true,
      'items', (SELECT rpc_shortlist_list()->'items')
    );
  END IF;

  -- Insert new item
  INSERT INTO portal_shortlist (auth_user_id, program_id)
  VALUES (uid, p_program_id);

  v_current_count := v_current_count + 1;
  
  RAISE LOG 'SHORTLIST_ADDED auth_user_id=% program_id=% new_count=% limit=10', uid, p_program_id, v_current_count;

  RETURN jsonb_build_object(
    'ok', true,
    'added', true,
    'count', v_current_count,
    'limit', 10,
    'limit_reached', v_current_count >= 10
  );
END;
$$;

-- ============= RPC: SHORTLIST_REMOVE =============
CREATE OR REPLACE FUNCTION public.rpc_shortlist_remove(p_program_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid UUID := auth.uid();
  v_deleted boolean;
  v_current_count integer;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_program_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'invalid_program_id');
  END IF;

  -- Delete
  DELETE FROM portal_shortlist
  WHERE auth_user_id = uid AND program_id = p_program_id;
  
  v_deleted := FOUND;

  -- Get new count
  SELECT COUNT(*) INTO v_current_count
  FROM portal_shortlist WHERE auth_user_id = uid;

  RAISE LOG 'SHORTLIST_REMOVED auth_user_id=% program_id=% was_deleted=% new_count=%', uid, p_program_id, v_deleted, v_current_count;

  RETURN jsonb_build_object(
    'ok', true,
    'removed', v_deleted,
    'count', v_current_count,
    'limit', 10,
    'limit_reached', v_current_count >= 10
  );
END;
$$;