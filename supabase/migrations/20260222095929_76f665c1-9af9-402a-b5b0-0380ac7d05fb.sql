
DROP FUNCTION rpc_d4_select_targets(text, integer);

CREATE OR REPLACE FUNCTION rpc_d4_select_targets(p_field_name text, p_limit int)
RETURNS TABLE(
  university_id uuid,
  university_name text,
  country_code text,
  uniranks_slug text,
  uniranks_rank int
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  (
    SELECT u.id, u.name, u.country_code, u.uniranks_slug, u.uniranks_rank
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
    LIMIT p_limit
  )
  UNION ALL
  (
    SELECT u.id, u.name, u.country_code, u.uniranks_slug, u.uniranks_rank
    FROM universities u
    JOIN university_enrichment_draft d 
      ON d.university_id = u.id 
      AND d.field_name = p_field_name
    WHERE d.status = 'pending'
      AND d.attempt_count < d.max_attempts
      AND (d.next_retry_after IS NULL OR d.next_retry_after <= now())
      AND (
        CASE WHEN p_field_name = 'website' THEN u.website IS NULL
             ELSE TRUE
        END
      )
    ORDER BY u.uniranks_rank ASC NULLS LAST
    LIMIT p_limit
  )
  LIMIT p_limit;
$$;
