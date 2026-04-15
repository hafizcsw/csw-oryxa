
-- Drop old overloads
DROP FUNCTION IF EXISTS public.rpc_admin_door2_review_queue(uuid, text, text[], interval, int, int);

-- Drop old rpc_get_door2_live if exists with wrong signature
DROP FUNCTION IF EXISTS public.rpc_get_door2_live(jsonb);

NOTIFY pgrst, 'reload schema';
