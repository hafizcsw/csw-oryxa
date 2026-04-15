
-- Fix: include trace_id inside details_json for telemetry correlation
CREATE OR REPLACE FUNCTION public.rpc_upsert_uniranks_signals(
  p_university_id uuid,
  p_trace_id text,
  p_signals jsonb DEFAULT '{}'::jsonb,
  p_snapshot jsonb DEFAULT NULL,
  p_sections_present text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_fields text[] := '{}';
  v_verified boolean;
  v_recognized boolean;
  v_profile_url text;
  v_badges text[];
  v_top_buckets text[];
  v_country_rank integer;
  v_region_rank integer;
  v_world_rank integer;
  v_data_quality text;
  v_snapshot_hash text;
BEGIN
  -- Validate university exists
  IF NOT EXISTS (SELECT 1 FROM universities WHERE id = p_university_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'university_not_found');
  END IF;

  -- Extract and validate signals
  v_verified := (p_signals->>'verified')::boolean;
  v_recognized := (p_signals->>'recognized')::boolean;
  v_profile_url := trim(p_signals->>'profile_url');
  v_data_quality := coalesce(trim(p_signals->>'data_quality'), 'raw');

  -- Validate profile_url (basic URL check)
  IF v_profile_url IS NOT NULL AND v_profile_url != '' THEN
    IF v_profile_url !~ '^https?://' THEN
      v_profile_url := NULL;
    END IF;
    v_updated_fields := array_append(v_updated_fields, 'profile_url');
  END IF;

  -- Extract arrays with size cap (max 50)
  IF p_signals ? 'badges' THEN
    SELECT array_agg(trim(b))
    INTO v_badges
    FROM jsonb_array_elements_text(p_signals->'badges') AS b
    LIMIT 50;
    v_updated_fields := array_append(v_updated_fields, 'badges');
  END IF;

  IF p_signals ? 'top_buckets' THEN
    SELECT array_agg(trim(b))
    INTO v_top_buckets
    FROM jsonb_array_elements_text(p_signals->'top_buckets') AS b
    LIMIT 50;
    v_updated_fields := array_append(v_updated_fields, 'top_buckets');
  END IF;

  -- Extract ranks (must be positive integers)
  IF p_signals ? 'country_rank' THEN
    v_country_rank := (p_signals->>'country_rank')::integer;
    IF v_country_rank IS NOT NULL AND v_country_rank <= 0 THEN v_country_rank := NULL; END IF;
    v_updated_fields := array_append(v_updated_fields, 'country_rank');
  END IF;

  IF p_signals ? 'region_rank' THEN
    v_region_rank := (p_signals->>'region_rank')::integer;
    IF v_region_rank IS NOT NULL AND v_region_rank <= 0 THEN v_region_rank := NULL; END IF;
    v_updated_fields := array_append(v_updated_fields, 'region_rank');
  END IF;

  IF p_signals ? 'world_rank' THEN
    v_world_rank := (p_signals->>'world_rank')::integer;
    IF v_world_rank IS NOT NULL AND v_world_rank <= 0 THEN v_world_rank := NULL; END IF;
    v_updated_fields := array_append(v_updated_fields, 'world_rank');
  END IF;

  IF p_signals ? 'verified' THEN v_updated_fields := array_append(v_updated_fields, 'verified'); END IF;
  IF p_signals ? 'recognized' THEN v_updated_fields := array_append(v_updated_fields, 'recognized'); END IF;

  -- Compute snapshot hash if snapshot provided
  IF p_snapshot IS NOT NULL THEN
    v_snapshot_hash := md5(p_snapshot::text);
    v_updated_fields := array_append(v_updated_fields, 'snapshot');
  END IF;

  -- Validate data_quality enum
  IF v_data_quality NOT IN ('raw', 'partial', 'reviewed') THEN
    v_data_quality := 'raw';
  END IF;

  -- Update university
  UPDATE universities SET
    uniranks_verified = coalesce(v_verified, uniranks_verified),
    uniranks_recognized = coalesce(v_recognized, uniranks_recognized),
    uniranks_profile_url = coalesce(v_profile_url, uniranks_profile_url),
    uniranks_badges = coalesce(v_badges, uniranks_badges),
    uniranks_top_buckets = coalesce(v_top_buckets, uniranks_top_buckets),
    uniranks_country_rank = coalesce(v_country_rank, uniranks_country_rank),
    uniranks_region_rank = coalesce(v_region_rank, uniranks_region_rank),
    uniranks_world_rank = coalesce(v_world_rank, uniranks_world_rank),
    uniranks_data_quality = v_data_quality,
    uniranks_last_reviewed_at = now(),
    uniranks_last_reviewed_by = auth.uid(),
    uniranks_snapshot = coalesce(p_snapshot, uniranks_snapshot),
    uniranks_sections_present = coalesce(p_sections_present, uniranks_sections_present),
    uniranks_snapshot_hash = coalesce(v_snapshot_hash, uniranks_snapshot_hash),
    uniranks_snapshot_at = CASE WHEN p_snapshot IS NOT NULL THEN now() ELSE uniranks_snapshot_at END,
    uniranks_snapshot_trace_id = coalesce(p_trace_id, uniranks_snapshot_trace_id)
  WHERE id = p_university_id;

  -- Telemetry: studio_uniranks_saved (trace_id INSIDE details_json)
  INSERT INTO pipeline_health_events (pipeline, event_type, trace_id, details_json)
  VALUES (
    'studio',
    'studio_uniranks_saved',
    p_trace_id,
    jsonb_build_object(
      'trace_id', p_trace_id,
      'university_id', p_university_id,
      'updated_fields', to_jsonb(v_updated_fields),
      'actor_id', auth.uid(),
      'env', 'production',
      'project_ref', 'alkhaznaqdlxygeznapt'
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'university_id', p_university_id,
    'updated_fields', to_jsonb(v_updated_fields)
  );
END;
$$;
