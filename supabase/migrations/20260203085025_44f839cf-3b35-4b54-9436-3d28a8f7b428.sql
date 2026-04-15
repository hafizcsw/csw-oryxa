-- Drop the OLD overload that doesn't have p_customer_id
DROP FUNCTION IF EXISTS public.rpc_notarized_order_create(text[], text, text[]);