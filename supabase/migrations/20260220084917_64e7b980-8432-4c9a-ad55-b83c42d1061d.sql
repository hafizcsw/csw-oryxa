
-- 1) Update rpc_lock_door2_program_urls to accept optional university_ids filter
CREATE OR REPLACE FUNCTION public.rpc_lock_door2_program_urls(
  p_limit integer DEFAULT 48,
  p_locked_by text DEFAULT 'runner'::text,
  p_university_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(id bigint, url text, university_id uuid, kind text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT pu.id
    FROM program_urls pu
    WHERE pu.status IN ('pending', 'retry', 'fetched')
      AND pu.kind = 'program'
      AND pu.discovered_from LIKE 'door2:%'
      AND pu.url NOT LIKE '%#%'
      AND (pu.lease_expires_at IS NULL OR pu.lease_expires_at < now())
      AND (p_university_ids IS NULL OR pu.university_id = ANY(p_university_ids))
    ORDER BY 
      CASE pu.status 
        WHEN 'fetched' THEN 1
        WHEN 'pending' THEN 2
        WHEN 'retry' THEN 3
      END,
      pu.created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE program_urls pu
  SET 
    status = 'fetching',
    locked_by = p_locked_by,
    locked_at = now(),
    lease_expires_at = now() + interval '5 minutes',
    attempts = COALESCE(pu.attempts, 0) + 1
  FROM candidates c
  WHERE pu.id = c.id
  RETURNING pu.id, pu.url, pu.university_id, pu.kind;
END;
$function$;

-- 2) RPC for per-university batch progress (used by dashboard)
CREATE OR REPLACE FUNCTION public.rpc_door2_batch_progress(p_university_ids uuid[])
RETURNS TABLE(
  university_id uuid,
  university_name text,
  uniranks_rank integer,
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
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      count(*) FILTER (WHERE pd.tuition_fee IS NOT NULL) AS has_tuition,
      count(*) FILTER (WHERE (pd.extracted_json->>'ielts_min') IS NOT NULL) AS has_ielts,
      count(*) FILTER (WHERE pd.degree_level IS NOT NULL) AS has_degree
    FROM program_draft pd
    WHERE pd.university_id = u.id
      AND pd.schema_version = 'door2-detail-v1'
  ) draft_stats ON true
  WHERE u.id = ANY(p_university_ids)
  ORDER BY u.uniranks_rank ASC NULLS LAST;
$function$;

-- 3) RPC to pick next sequential batch (by rank, from profile_pending)
CREATE OR REPLACE FUNCTION public.rpc_door2_pick_sequential_batch(
  p_batch_size integer DEFAULT 5
)
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT array_agg(sub.uid)
  FROM (
    SELECT u.id AS uid
    FROM uniranks_crawl_state cs
    JOIN universities u ON u.id::text = cs.university_id
    WHERE cs.stage IN ('profile_pending', 'programs_pending')
      AND cs.quarantine_reason IS NULL
    ORDER BY u.uniranks_rank ASC NULLS LAST
    LIMIT p_batch_size
  ) sub;
$function$;
