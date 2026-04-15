
-- ============= UNIVERSITY SHORTLIST TABLE =============
CREATE TABLE public.portal_shortlist_universities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  university_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(auth_user_id, university_id)
);

CREATE INDEX idx_portal_shortlist_uni_user ON public.portal_shortlist_universities(auth_user_id);
CREATE INDEX idx_portal_shortlist_uni_id ON public.portal_shortlist_universities(university_id);

ALTER TABLE public.portal_shortlist_universities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own uni shortlist"
ON public.portal_shortlist_universities FOR SELECT
USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can insert own uni shortlist"
ON public.portal_shortlist_universities FOR INSERT
WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "Users can delete own uni shortlist"
ON public.portal_shortlist_universities FOR DELETE
USING (auth.uid() = auth_user_id);

-- ============= RPC: UNI SHORTLIST LIST =============
CREATE OR REPLACE FUNCTION public.rpc_uni_shortlist_list()
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
  FROM portal_shortlist_universities
  WHERE auth_user_id = uid;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'university_id', psu.university_id,
      'created_at', psu.created_at
    ) ORDER BY psu.created_at DESC
  ), '[]'::jsonb) INTO v_items
  FROM portal_shortlist_universities psu
  WHERE psu.auth_user_id = uid;

  RETURN jsonb_build_object(
    'ok', true,
    'count', v_count,
    'limit', 20,
    'items', v_items
  );
END;
$$;

-- ============= RPC: UNI SHORTLIST ADD =============
CREATE OR REPLACE FUNCTION public.rpc_uni_shortlist_add(p_university_id UUID)
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

  IF p_university_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'invalid_university_id');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM portal_shortlist_universities
    WHERE auth_user_id = uid AND university_id = p_university_id
  ) INTO v_already_exists;

  IF v_already_exists THEN
    SELECT COUNT(*) INTO v_current_count
    FROM portal_shortlist_universities WHERE auth_user_id = uid;
    
    RETURN jsonb_build_object(
      'ok', true,
      'already_exists', true,
      'count', v_current_count,
      'limit', 20,
      'limit_reached', v_current_count >= 20
    );
  END IF;

  SELECT COUNT(*) INTO v_current_count
  FROM portal_shortlist_universities WHERE auth_user_id = uid;

  IF v_current_count >= 20 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'uni_shortlist_limit_reached',
      'count', v_current_count,
      'limit', 20,
      'limit_reached', true
    );
  END IF;

  INSERT INTO portal_shortlist_universities (auth_user_id, university_id)
  VALUES (uid, p_university_id);

  v_current_count := v_current_count + 1;

  RETURN jsonb_build_object(
    'ok', true,
    'added', true,
    'count', v_current_count,
    'limit', 20,
    'limit_reached', v_current_count >= 20
  );
END;
$$;

-- ============= RPC: UNI SHORTLIST REMOVE =============
CREATE OR REPLACE FUNCTION public.rpc_uni_shortlist_remove(p_university_id UUID)
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

  IF p_university_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'invalid_university_id');
  END IF;

  DELETE FROM portal_shortlist_universities
  WHERE auth_user_id = uid AND university_id = p_university_id;
  
  v_deleted := FOUND;

  SELECT COUNT(*) INTO v_current_count
  FROM portal_shortlist_universities WHERE auth_user_id = uid;

  RETURN jsonb_build_object(
    'ok', true,
    'removed', v_deleted,
    'count', v_current_count,
    'limit', 20,
    'limit_reached', v_current_count >= 20
  );
END;
$$;
