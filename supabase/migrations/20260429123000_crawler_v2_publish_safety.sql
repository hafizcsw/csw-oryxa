-- Crawler v2 publish safety tightening.
-- Keeps verify and publish separate, fixes verify audit action naming, and
-- requires the run item itself to be verified before publish can proceed.

CREATE OR REPLACE FUNCTION public.rpc_v2_verify_run_item(
  p_run_item_id  uuid,
  p_reviewer_id  uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_item          public.crawler_run_items%ROWTYPE;
  v_evidence_count    integer;
  v_trace_id          text;
BEGIN
  SELECT * INTO v_run_item
    FROM public.crawler_run_items
   WHERE id = p_run_item_id
     FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'run_item_not_found');
  END IF;

  IF v_run_item.status NOT IN ('needs_review', 'evidence_created', 'draft_created') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'invalid_status_for_verify',
      'current_status', v_run_item.status
    );
  END IF;

  v_trace_id := v_run_item.trace_id;

  UPDATE public.evidence_items
     SET review_status = 'verified',
         updated_at    = now()
   WHERE crawler_run_item_id = p_run_item_id
     AND review_status IN ('pending', 'needs_revision');

  GET DIAGNOSTICS v_evidence_count = ROW_COUNT;

  UPDATE public.crawler_run_items
     SET status           = 'verified',
         stage            = 'evidence_verified',
         progress_percent = 92,
         updated_at       = now()
   WHERE id = p_run_item_id;

  INSERT INTO public.publish_audit_trail
    (entity_type, entity_uuid, entity_text_id, action, trace_id, evidence_item_ids,
     before_snapshot, after_snapshot, published_by)
  VALUES (
    'run_item',
    p_run_item_id,
    v_run_item.university_id::text,
    'verify',
    v_trace_id,
    ARRAY(
      SELECT id FROM public.evidence_items
       WHERE crawler_run_item_id = p_run_item_id
         AND review_status = 'verified'
    ),
    jsonb_build_object('status', v_run_item.status, 'progress', v_run_item.progress_percent),
    jsonb_build_object('status', 'verified', 'progress', 92, 'evidence_verified', v_evidence_count),
    p_reviewer_id
  );

  RETURN jsonb_build_object(
    'ok',                true,
    'evidence_verified', v_evidence_count,
    'run_item_id',       p_run_item_id,
    'trace_id',          v_trace_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_v2_verify_run_item FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rpc_v2_verify_run_item TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_v2_publish_run_item(
  p_run_item_id   uuid,
  p_publisher_id  uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_item           public.crawler_run_items%ROWTYPE;
  v_evidence_count     integer;
  v_unverified_count   integer;
  v_trace_id           text;
  v_before_snapshot    jsonb;
  v_after_snapshot     jsonb;
  v_evidence_ids       uuid[];
  v_conf_avg           integer;
  v_conf_min           integer;
BEGIN
  SELECT * INTO v_run_item
    FROM public.crawler_run_items
   WHERE id = p_run_item_id
     FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'run_item_not_found');
  END IF;

  IF v_run_item.status <> 'verified' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'invalid_status_for_publish',
      'current_status', v_run_item.status,
      'required_status', 'verified'
    );
  END IF;

  v_trace_id := v_run_item.trace_id;

  SELECT COUNT(*) INTO v_unverified_count
    FROM public.evidence_items
   WHERE crawler_run_item_id = p_run_item_id
     AND review_status IN ('pending', 'needs_revision')
     AND publish_status = 'unpublished';

  IF v_unverified_count > 0 THEN
    RETURN jsonb_build_object(
      'ok',               false,
      'error',            'unverified_evidence_exists',
      'unverified_count', v_unverified_count
    );
  END IF;

  SELECT
    ARRAY_AGG(id),
    AVG(confidence_0_100)::integer,
    MIN(confidence_0_100)
  INTO v_evidence_ids, v_conf_avg, v_conf_min
    FROM public.evidence_items
   WHERE crawler_run_item_id = p_run_item_id
     AND review_status = 'verified'
     AND publish_status = 'unpublished';

  IF COALESCE(array_length(v_evidence_ids, 1), 0) = 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'no_verified_unpublished_evidence'
    );
  END IF;

  v_before_snapshot := jsonb_build_object(
    'run_item_status', v_run_item.status,
    'evidence_count',  array_length(v_evidence_ids, 1),
    'confidence_avg',  v_conf_avg,
    'confidence_min',  v_conf_min,
    'snapshotted_at',  now()
  );

  UPDATE public.evidence_items
     SET publish_status = 'published',
         updated_at     = now()
   WHERE crawler_run_item_id = p_run_item_id
     AND review_status       = 'verified'
     AND publish_status      = 'unpublished';

  GET DIAGNOSTICS v_evidence_count = ROW_COUNT;

  v_after_snapshot := jsonb_build_object(
    'run_item_status',    'published',
    'evidence_published', v_evidence_count,
    'confidence_avg',     v_conf_avg,
    'confidence_min',     v_conf_min,
    'published_at',       now()
  );

  INSERT INTO public.publish_audit_trail
    (entity_type, entity_uuid, entity_text_id, action, trace_id,
     evidence_item_ids, confidence_min, confidence_avg,
     before_snapshot, after_snapshot,
     rollback_snapshot, published_by, published_at)
  VALUES (
    'run_item',
    p_run_item_id,
    v_run_item.university_id::text,
    'publish',
    v_trace_id,
    COALESCE(v_evidence_ids, '{}'),
    v_conf_min,
    v_conf_avg,
    v_before_snapshot,
    v_after_snapshot,
    jsonb_build_object(
      'revert_action',     'set_publish_status_unpublished',
      'evidence_item_ids', COALESCE(v_evidence_ids, '{}'),
      'university_id',     v_run_item.university_id
    ),
    p_publisher_id,
    now()
  );

  UPDATE public.crawler_run_items
     SET status           = 'published',
         stage            = 'evidence_published',
         progress_percent = 100,
         completed_at     = now(),
         updated_at       = now()
   WHERE id = p_run_item_id;

  RETURN jsonb_build_object(
    'ok',                 true,
    'evidence_published', v_evidence_count,
    'confidence_avg',     v_conf_avg,
    'confidence_min',     v_conf_min,
    'run_item_id',        p_run_item_id,
    'trace_id',           v_trace_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_v2_publish_run_item FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rpc_v2_publish_run_item TO service_role;
