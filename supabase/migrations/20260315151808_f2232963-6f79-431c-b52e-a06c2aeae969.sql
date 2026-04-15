CREATE TABLE IF NOT EXISTS public.portal_customer_map (
  crm_customer_id TEXT PRIMARY KEY,
  portal_auth_user_id UUID NOT NULL,
  phone_e164 TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(portal_auth_user_id)
);

ALTER TABLE public.portal_customer_map ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_pcm_portal_user ON public.portal_customer_map(portal_auth_user_id);
CREATE INDEX idx_pcm_phone ON public.portal_customer_map(phone_e164);

COMMENT ON TABLE public.portal_customer_map IS 'Maps CRM customer_id to Portal auth user_id. Bridges two separate Supabase identity namespaces.';