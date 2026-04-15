
-- Recreate the RPC with an optimized query using LEFT JOIN instead of NOT EXISTS
DROP FUNCTION IF EXISTS rpc_d4_select_targets(text, integer);

CREATE FUNCTION rpc_d4_select_targets(p_field_name text, p_limit int)
RETURNS TABLE(
  university_id uuid,
  university_name text,
  country_code text,
  uniranks_slug text,
  uniranks_rank int
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET statement_timeout = '15s'
AS $$
  SELECT u.id, u.name, u.country_code, u.uniranks_slug, u.uniranks_rank
  FROM universities u
  LEFT JOIN university_enrichment_draft d 
    ON d.university_id = u.id AND d.field_name = p_field_name
  WHERE u.uniranks_slug IS NOT NULL
    AND u.website IS NULL
    AND d.university_id IS NULL
  ORDER BY u.uniranks_rank ASC NULLS LAST
  LIMIT p_limit;
$$;
