-- =====================================================
-- PORTAL FIX PACK: Mirror Security Hardening
-- =====================================================

-- (1) 🔴 CRITICAL: Make Mirror READ-ONLY for users
-- Drop all write policies for users on customer_service_selections
DROP POLICY IF EXISTS "Users can insert own selections" ON public.customer_service_selections;
DROP POLICY IF EXISTS "Users can update own selections" ON public.customer_service_selections;
DROP POLICY IF EXISTS "Users can delete own selections" ON public.customer_service_selections;

-- Drop and recreate SELECT-only policy
DROP POLICY IF EXISTS "Users can view own selections" ON public.customer_service_selections;

CREATE POLICY "Users can view own selections"
ON public.customer_service_selections
FOR SELECT
USING (auth.uid() = auth_user_id);

-- (2) 🟡 Unify state_rev to bigint
ALTER TABLE public.customer_service_selections
ALTER COLUMN state_rev TYPE bigint;

-- (3) ✅ Harden RPCs: service_role ONLY
-- Revoke EXECUTE from public, anon, authenticated
-- Grant EXECUTE only to service_role

-- mirror_service_selection
REVOKE EXECUTE ON FUNCTION public.mirror_service_selection(
  uuid, text, text[], text[], text, text, jsonb, text, text, integer, text
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mirror_service_selection(
  uuid, text, text[], text[], text, text, jsonb, text, text, integer, text
) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mirror_service_selection(
  uuid, text, text[], text[], text, text, jsonb, text, text, integer, text
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mirror_service_selection(
  uuid, text, text[], text[], text, text, jsonb, text, text, integer, text
) TO service_role;

-- delete_service_selection
REVOKE EXECUTE ON FUNCTION public.delete_service_selection(uuid, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_service_selection(uuid, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_service_selection(uuid, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_service_selection(uuid, text, integer) TO service_role;

-- rpc_cleanup_hmac_nonces
REVOKE EXECUTE ON FUNCTION public.rpc_cleanup_hmac_nonces(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_cleanup_hmac_nonces(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_cleanup_hmac_nonces(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_cleanup_hmac_nonces(integer) TO service_role;