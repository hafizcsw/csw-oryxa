
-- P0 Fix 1: Fix array concat bug + restore backward compatibility for Door1 keys
CREATE OR REPLACE FUNCTION public.rpc_upsert_uniranks_signals(
  p_university_id uuid,
  p_trace_id text,
  p_signals jsonb,
  p_snapshot jsonb DEFAULT NULL,
  p_sections_present text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_fields text[] := ARRAY[]::text[];
  v_url text;
  v_region_label text;
BEGIN
  -- Accept both old keys (verified) and new keys (uniranks_verified)
  v_url := COALESCE(p_signals->>'uniranks_profile_url', p_signals->>'profile_url');
  IF v_url IS NOT NULL AND v_url !~ '^https?://' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_url');
  END IF;

  v_region_label := COALESCE(p_signals->>'uniranks_region_label', p_signals->>'region_label');

  UPDATE universities SET
    uniranks_verified = COALESCE(
      (p_signals->>'uniranks_verified')::boolean,
      (p_signals->>'verified')::boolean,
      uniranks_verified
    ),
    uniranks_recognized = COALESCE(
      (p_signals->>'uniranks_recognized')::boolean,
      (p_signals->>'recognized')::boolean,
      uniranks_recognized
    ),
    uniranks_profile_url = COALESCE(v_url, uniranks_profile_url),
    uniranks_badges = COALESCE(
      (SELECT array_agg(v)::text[] FROM jsonb_array_elements_text(
        CASE WHEN p_signals ? 'uniranks_badges' THEN p_signals->'uniranks_badges'
             WHEN p_signals ? 'badges' THEN p_signals->'badges'
             ELSE NULL END
      ) AS v LIMIT 50),
      uniranks_badges
    ),
    uniranks_top_buckets = COALESCE(
      (SELECT array_agg(v)::text[] FROM jsonb_array_elements_text(
        CASE WHEN p_signals ? 'uniranks_top_buckets' THEN p_signals->'uniranks_top_buckets'
             WHEN p_signals ? 'top_buckets' THEN p_signals->'top_buckets'
             ELSE NULL END
      ) AS v LIMIT 50),
      uniranks_top_buckets
    ),
    uniranks_country_rank = COALESCE(
      NULLIF((p_signals->>'uniranks_country_rank')::int, 0),
      NULLIF((p_signals->>'country_rank')::int, 0),
      uniranks_country_rank
    ),
    uniranks_region_rank = COALESCE(
      NULLIF((p_signals->>'uniranks_region_rank')::int, 0),
      NULLIF((p_signals->>'region_rank')::int, 0),
      uniranks_region_rank
    ),
    uniranks_world_rank = COALESCE(
      NULLIF((p_signals->>'uniranks_world_rank')::int, 0),
      NULLIF((p_signals->>'world_rank')::int, 0),
      uniranks_world_rank
    ),
    uniranks_region_label = COALESCE(v_region_label, uniranks_region_label),
    uniranks_data_quality = COALESCE(
      CASE WHEN COALESCE(p_signals->>'uniranks_data_quality', p_signals->>'data_quality') IN ('raw','partial','reviewed')
           THEN COALESCE(p_signals->>'uniranks_data_quality', p_signals->>'data_quality')
           ELSE NULL END,
      uniranks_data_quality
    ),
    uniranks_snapshot = COALESCE(p_snapshot, uniranks_snapshot),
    uniranks_sections_present = COALESCE(p_sections_present, uniranks_sections_present),
    uniranks_snapshot_hash = CASE WHEN p_snapshot IS NOT NULL THEN md5(p_snapshot::text) ELSE uniranks_snapshot_hash END,
    uniranks_snapshot_at = CASE WHEN p_snapshot IS NOT NULL THEN now() ELSE uniranks_snapshot_at END,
    uniranks_snapshot_trace_id = p_trace_id,
    uniranks_last_reviewed_at = now()
  WHERE id = p_university_id;

  -- Track updated fields using array_append (FIX: was || 'text' which is invalid)
  IF (p_signals ? 'verified') OR (p_signals ? 'uniranks_verified') THEN v_updated_fields := array_append(v_updated_fields, 'verified'); END IF;
  IF (p_signals ? 'recognized') OR (p_signals ? 'uniranks_recognized') THEN v_updated_fields := array_append(v_updated_fields, 'recognized'); END IF;
  IF (p_signals ? 'profile_url') OR (p_signals ? 'uniranks_profile_url') THEN v_updated_fields := array_append(v_updated_fields, 'profile_url'); END IF;
  IF (p_signals ? 'badges') OR (p_signals ? 'uniranks_badges') THEN v_updated_fields := array_append(v_updated_fields, 'badges'); END IF;
  IF (p_signals ? 'top_buckets') OR (p_signals ? 'uniranks_top_buckets') THEN v_updated_fields := array_append(v_updated_fields, 'top_buckets'); END IF;
  IF (p_signals ? 'country_rank') OR (p_signals ? 'uniranks_country_rank') THEN v_updated_fields := array_append(v_updated_fields, 'country_rank'); END IF;
  IF (p_signals ? 'region_rank') OR (p_signals ? 'uniranks_region_rank') THEN v_updated_fields := array_append(v_updated_fields, 'region_rank'); END IF;
  IF (p_signals ? 'world_rank') OR (p_signals ? 'uniranks_world_rank') THEN v_updated_fields := array_append(v_updated_fields, 'world_rank'); END IF;
  IF (p_signals ? 'region_label') OR (p_signals ? 'uniranks_region_label') THEN v_updated_fields := array_append(v_updated_fields, 'region_label'); END IF;
  IF (p_signals ? 'data_quality') OR (p_signals ? 'uniranks_data_quality') THEN v_updated_fields := array_append(v_updated_fields, 'data_quality'); END IF;
  IF p_snapshot IS NOT NULL THEN v_updated_fields := array_append(v_updated_fields, 'snapshot'); END IF;
  IF p_sections_present IS NOT NULL THEN v_updated_fields := array_append(v_updated_fields, 'sections_present'); END IF;

  INSERT INTO pipeline_health_events (pipeline, event_type, details_json)
  VALUES (
    'studio',
    'studio_uniranks_saved',
    jsonb_build_object(
      'trace_id', p_trace_id,
      'university_id', p_university_id,
      'updated_fields', to_jsonb(v_updated_fields),
      'project_ref', current_setting('app.settings.project_ref', true),
      'env', current_setting('app.settings.environment', true)
    )
  );

  RETURN jsonb_build_object('ok', true, 'updated_fields', v_updated_fields);
END;
$$;

-- P0 Fix 3: Create RPC for crawl progress updates (replaces direct UPDATE)
CREATE OR REPLACE FUNCTION public.rpc_set_university_crawl_progress(
  p_university_id uuid,
  p_status text,
  p_pages_total int DEFAULT NULL,
  p_pages_done int DEFAULT NULL,
  p_trace_id text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_uniranks_rank int DEFAULT NULL,
  p_uniranks_score numeric DEFAULT NULL,
  p_error_json jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valid_statuses text[] := ARRAY[
    'pending','locked','resolving','websites','website_error','no_official_website',
    'dedup_conflict','uniranks_profile_done','website_resolved',
    'logo_done','logo_failed','programs_partial','programs_done',
    'uniranks_no_programs','uniranks_done','uniranks_partial',
    'new_from_catalog','crawling','error'
  ];
BEGIN
  IF NOT (p_status = ANY(v_valid_statuses)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status: ' || p_status);
  END IF;

  UPDATE universities SET
    crawl_status = p_status,
    crawl_last_attempt = now(),
    uniranks_program_pages_total = COALESCE(p_pages_total, uniranks_program_pages_total),
    uniranks_program_pages_done = COALESCE(p_pages_done, uniranks_program_pages_done),
    uniranks_last_trace_id = COALESCE(p_trace_id, uniranks_last_trace_id),
    description = COALESCE(p_description, description),
    uniranks_rank = COALESCE(p_uniranks_rank, uniranks_rank),
    uniranks_score = COALESCE(p_uniranks_score, uniranks_score),
    crawl_error = CASE WHEN p_error_json IS NOT NULL THEN (p_error_json->>'message')::text ELSE crawl_error END
  WHERE id = p_university_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;
