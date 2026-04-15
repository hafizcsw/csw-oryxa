
-- ========================================
-- Global Crawl v1: Policy + Logo + Bucket
-- ========================================

-- 1) Add crawl_policy to crawl_settings
INSERT INTO public.crawl_settings (key, value, updated_at)
VALUES ('crawl_policy', '{"mode":"official","fallback_order":["qs","uniranks"],"logo_source_order":["official","uniranks","qs"],"resolver_batch_size":50,"discovery_batch_size":200,"fetch_batch_size":50,"extract_batch_size":25}'::jsonb, now())
ON CONFLICT (key) DO NOTHING;

-- 2) Add logo columns to universities (logo_url already exists)
ALTER TABLE public.universities ADD COLUMN IF NOT EXISTS logo_source text;
ALTER TABLE public.universities ADD COLUMN IF NOT EXISTS logo_updated_at timestamptz;
ALTER TABLE public.universities ADD COLUMN IF NOT EXISTS qs_slug text;
ALTER TABLE public.universities ADD COLUMN IF NOT EXISTS qs_profile_url text;

-- Unique constraint on qs_slug (dedup)
CREATE UNIQUE INDEX IF NOT EXISTS idx_universities_qs_slug 
ON public.universities (qs_slug) WHERE qs_slug IS NOT NULL;

-- 3) RPC: Set crawl policy (service_role only)
CREATE OR REPLACE FUNCTION public.rpc_set_crawl_policy(p_policy jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO crawl_settings (key, value, updated_at)
  VALUES ('crawl_policy', p_policy, now())
  ON CONFLICT (key) DO UPDATE SET value = p_policy, updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_set_crawl_policy(jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_set_crawl_policy(jsonb) TO service_role;

-- 4) RPC: Set university logo (service_role only)
CREATE OR REPLACE FUNCTION public.rpc_set_university_logo(
  p_university_id uuid,
  p_logo_url text,
  p_source text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE universities
  SET logo_url = p_logo_url,
      logo_source = p_source,
      logo_updated_at = now()
  WHERE id = p_university_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_set_university_logo(uuid, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_set_university_logo(uuid, text, text) TO service_role;

-- 5) Storage bucket for university logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('university-logos', 'university-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read policy for logos
CREATE POLICY "University logos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'university-logos');

-- Service role can upload logos (via edge functions)
CREATE POLICY "Service role can upload university logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'university-logos');

CREATE POLICY "Service role can update university logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'university-logos');
