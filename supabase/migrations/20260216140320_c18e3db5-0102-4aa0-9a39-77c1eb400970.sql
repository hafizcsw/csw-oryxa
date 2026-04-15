-- Door 2: Add uniranks_region_label column
ALTER TABLE public.universities
ADD COLUMN IF NOT EXISTS uniranks_region_label text;

COMMENT ON COLUMN public.universities.uniranks_region_label IS 'Region label from UniRanks (e.g. North America, Europe, Arab World)';

-- Drop and recreate RPC with region_label support
DROP FUNCTION IF EXISTS public.rpc_upsert_uniranks_signals(uuid, text, jsonb, jsonb, text[]);

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
  v_updated_fields text[] := '{}';
  v_url text;
  v_region_label text;
BEGIN
  v_url := p_signals->>'uniranks_profile_url';
  IF v_url IS NOT NULL AND v_url !~ '^https?://' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_url');
  END IF;

  v_region_label := p_signals->>'uniranks_region_label';

  UPDATE universities SET
    uniranks_verified = COALESCE((p_signals->>'uniranks_verified')::boolean, uniranks_verified),
    uniranks_recognized = COALESCE((p_signals->>'uniranks_recognized')::boolean, uniranks_recognized),
    uniranks_profile_url = COALESCE(v_url, uniranks_profile_url),
    uniranks_badges = COALESCE((SELECT array_agg(v)::text[] FROM jsonb_array_elements_text(p_signals->'uniranks_badges') AS v LIMIT 50), uniranks_badges),
    uniranks_top_buckets = COALESCE((SELECT array_agg(v)::text[] FROM jsonb_array_elements_text(p_signals->'uniranks_top_buckets') AS v LIMIT 50), uniranks_top_buckets),
    uniranks_country_rank = COALESCE(NULLIF((p_signals->>'uniranks_country_rank')::int, 0), uniranks_country_rank),
    uniranks_region_rank = COALESCE(NULLIF((p_signals->>'uniranks_region_rank')::int, 0), uniranks_region_rank),
    uniranks_world_rank = COALESCE(NULLIF((p_signals->>'uniranks_world_rank')::int, 0), uniranks_world_rank),
    uniranks_region_label = COALESCE(v_region_label, uniranks_region_label),
    uniranks_data_quality = COALESCE(
      CASE WHEN p_signals->>'uniranks_data_quality' IN ('raw','partial','reviewed') THEN p_signals->>'uniranks_data_quality' ELSE NULL END,
      uniranks_data_quality
    ),
    uniranks_snapshot = COALESCE(p_snapshot, uniranks_snapshot),
    uniranks_sections_present = COALESCE(p_sections_present, uniranks_sections_present),
    uniranks_snapshot_hash = CASE WHEN p_snapshot IS NOT NULL THEN md5(p_snapshot::text) ELSE uniranks_snapshot_hash END,
    uniranks_snapshot_at = CASE WHEN p_snapshot IS NOT NULL THEN now() ELSE uniranks_snapshot_at END,
    uniranks_snapshot_trace_id = p_trace_id,
    uniranks_last_reviewed_at = now(),
    updated_at = now()
  WHERE id = p_university_id;

  IF p_signals ? 'uniranks_verified' THEN v_updated_fields := v_updated_fields || 'verified'; END IF;
  IF p_signals ? 'uniranks_recognized' THEN v_updated_fields := v_updated_fields || 'recognized'; END IF;
  IF p_signals ? 'uniranks_profile_url' THEN v_updated_fields := v_updated_fields || 'profile_url'; END IF;
  IF p_signals ? 'uniranks_badges' THEN v_updated_fields := v_updated_fields || 'badges'; END IF;
  IF p_signals ? 'uniranks_top_buckets' THEN v_updated_fields := v_updated_fields || 'top_buckets'; END IF;
  IF p_signals ? 'uniranks_country_rank' THEN v_updated_fields := v_updated_fields || 'country_rank'; END IF;
  IF p_signals ? 'uniranks_region_rank' THEN v_updated_fields := v_updated_fields || 'region_rank'; END IF;
  IF p_signals ? 'uniranks_world_rank' THEN v_updated_fields := v_updated_fields || 'world_rank'; END IF;
  IF p_signals ? 'uniranks_region_label' THEN v_updated_fields := v_updated_fields || 'region_label'; END IF;
  IF p_signals ? 'uniranks_data_quality' THEN v_updated_fields := v_updated_fields || 'data_quality'; END IF;
  IF p_snapshot IS NOT NULL THEN v_updated_fields := v_updated_fields || 'snapshot'; END IF;
  IF p_sections_present IS NOT NULL THEN v_updated_fields := v_updated_fields || 'sections_present'; END IF;

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