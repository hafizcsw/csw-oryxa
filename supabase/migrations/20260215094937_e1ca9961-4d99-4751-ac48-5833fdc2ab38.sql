
DROP FUNCTION IF EXISTS public.rpc_set_university_website(uuid, text, text, text, numeric);

CREATE OR REPLACE FUNCTION public.rpc_set_university_website(
  p_university_id uuid,
  p_website text,
  p_source text,
  p_etld1 text,
  p_confidence numeric DEFAULT 0.8
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_existing TEXT;
BEGIN
  -- Hard guardrail: never accept uniranks.com as official website
  IF lower(p_etld1) = 'uniranks.com' OR lower(p_website) LIKE '%uniranks.com%' THEN
    RETURN jsonb_build_object('status', 'rejected', 'reason', 'uniranks_domain_blocked');
  END IF;

  SELECT id::text INTO v_existing FROM universities
  WHERE website_etld1 = p_etld1 AND id != p_university_id;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'conflict', 'conflicting_id', v_existing);
  END IF;
  UPDATE universities SET
    website = p_website, website_source = p_source, website_etld1 = p_etld1,
    website_confidence = p_confidence, website_resolved_at = now(),
    crawl_status = 'website_resolved', crawl_error = NULL
  WHERE id = p_university_id;
  RETURN jsonb_build_object('status', 'ok');
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_set_university_website FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_set_university_website TO service_role;
