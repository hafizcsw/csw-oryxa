DROP FUNCTION IF EXISTS rpc_door2_batch_progress(uuid[]);

CREATE FUNCTION rpc_door2_batch_progress(p_university_ids uuid[])
RETURNS TABLE(
  university_id uuid,
  university_name text,
  uniranks_rank bigint,
  crawl_stage text,
  programs_total bigint,
  programs_extracted bigint,
  programs_failed bigint,
  programs_pending bigint,
  drafts_count bigint,
  has_tuition bigint,
  has_ielts bigint,
  has_degree bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    u.id AS university_id,
    u.name_en AS university_name,
    u.uniranks_rank,
    cs.stage AS crawl_stage,
    COALESCE(pu_stats.total, 0) AS programs_total,
    COALESCE(pu_stats.extracted, 0) AS programs_extracted,
    COALESCE(pu_stats.failed, 0) AS programs_failed,
    COALESCE(pu_stats.pending, 0) AS programs_pending,
    COALESCE(draft_stats.cnt, 0) AS drafts_count,
    COALESCE(draft_stats.has_tuition, 0) AS has_tuition,
    COALESCE(draft_stats.has_ielts, 0) AS has_ielts,
    COALESCE(draft_stats.has_degree, 0) AS has_degree
  FROM universities u
  LEFT JOIN uniranks_crawl_state cs ON cs.university_id = u.id::text
  LEFT JOIN LATERAL (
    SELECT 
      count(*) AS total,
      count(*) FILTER (WHERE pu.status = 'extracted') AS extracted,
      count(*) FILTER (WHERE pu.status = 'failed') AS failed,
      count(*) FILTER (WHERE pu.status IN ('pending','fetching','fetched','retry')) AS pending
    FROM program_urls pu
    WHERE pu.university_id = u.id 
      AND pu.discovered_from LIKE 'door2:%'
  ) pu_stats ON true
  LEFT JOIN LATERAL (
    SELECT 
      count(*) AS cnt,
      count(*) FILTER (WHERE pd.tuition_fee IS NOT NULL OR (pd.extracted_json->>'tuition_amount') IS NOT NULL) AS has_tuition,
      count(*) FILTER (WHERE (pd.extracted_json->>'ielts_min') IS NOT NULL) AS has_ielts,
      count(*) FILTER (WHERE pd.degree_level IS NOT NULL OR (pd.extracted_json->>'degree') IS NOT NULL OR (pd.extracted_json->>'study_level') IS NOT NULL) AS has_degree
    FROM program_draft pd
    WHERE pd.university_id = u.id
      AND pd.schema_version = 'door2-detail-v1'
  ) draft_stats ON true
  WHERE u.id = ANY(p_university_ids)
  ORDER BY u.uniranks_rank ASC NULLS LAST;
$$;