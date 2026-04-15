CREATE OR REPLACE FUNCTION public.rpc_d4_select_targets(
  p_field_name text DEFAULT 'website',
  p_limit int DEFAULT 20
)
RETURNS TABLE(
  university_id uuid,
  university_name text,
  uniranks_slug text,
  uniranks_rank int
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.name, u.uniranks_slug, u.uniranks_rank
  FROM universities u
  WHERE u.uniranks_slug IS NOT NULL
    AND (
      CASE WHEN p_field_name = 'website' THEN u.website IS NULL
           ELSE TRUE
      END
    )
    AND NOT EXISTS (
      SELECT 1 FROM university_enrichment_draft d
      WHERE d.university_id = u.id
        AND d.field_name = p_field_name
    )
  ORDER BY u.uniranks_rank ASC NULLS LAST
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.rpc_d4_select_targets FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_d4_select_targets TO service_role;