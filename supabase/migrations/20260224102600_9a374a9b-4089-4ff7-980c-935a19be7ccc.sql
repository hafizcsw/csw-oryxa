
-- RPC: Sync job counters from row_stats (single source of truth)
CREATE OR REPLACE FUNCTION public.sync_osc_job_counters(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stats jsonb;
  v_total int;
  v_processed int;
  v_verified int;
  v_published int;
  v_published_partial int;
  v_quarantined int;
  v_failed int;
  v_special int;
  v_queued int;
  v_fetching int;
  v_extracting int;
  v_verifying int;
BEGIN
  SELECT
    count(*) FILTER (WHERE crawl_status = 'queued'),
    count(*) FILTER (WHERE crawl_status = 'fetching'),
    count(*) FILTER (WHERE crawl_status = 'extracting'),
    count(*) FILTER (WHERE crawl_status = 'verifying'),
    count(*) FILTER (WHERE crawl_status = 'verified'),
    count(*) FILTER (WHERE crawl_status = 'published'),
    count(*) FILTER (WHERE crawl_status = 'published_partial'),
    count(*) FILTER (WHERE crawl_status = 'quarantined'),
    count(*) FILTER (WHERE crawl_status = 'failed'),
    count(*) FILTER (WHERE crawl_status = 'special'),
    count(*)
  INTO v_queued, v_fetching, v_extracting, v_verifying, v_verified, v_published, v_published_partial, v_quarantined, v_failed, v_special, v_total
  FROM official_site_crawl_rows
  WHERE job_id = p_job_id;

  v_processed := v_total - v_queued - v_fetching - v_extracting;

  v_stats := jsonb_build_object(
    'total', v_total,
    'queued', v_queued,
    'fetching', v_fetching,
    'extracting', v_extracting,
    'verifying', v_verifying,
    'verified', v_verified,
    'published', v_published,
    'published_partial', v_published_partial,
    'quarantined', v_quarantined,
    'failed', v_failed,
    'special', v_special,
    'processed', v_processed
  );

  -- Update job row with synced counters
  UPDATE official_site_crawl_jobs
  SET 
    stats_json = COALESCE(stats_json, '{}'::jsonb) || jsonb_build_object('synced_counters', v_stats, 'synced_at', now()),
    updated_at = now()
  WHERE id = p_job_id;

  RETURN v_stats;
END;
$$;
