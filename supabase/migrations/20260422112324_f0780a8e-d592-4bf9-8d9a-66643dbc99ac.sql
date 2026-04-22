INSERT INTO public.portal_customer_map (portal_auth_user_id, crm_customer_id)
VALUES ('ea77d36f-c6c3-4aa9-a4dc-16946e084511', 'df5770b6-6e33-4a5c-a449-7df12078def6')
ON CONFLICT (portal_auth_user_id) DO UPDATE SET crm_customer_id = EXCLUDED.crm_customer_id, updated_at = now();