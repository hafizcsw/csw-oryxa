CREATE OR REPLACE FUNCTION public.phase_a_purge_for_documents(_doc_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _award_deleted int := 0;
  _norm_deleted int := 0;
  _log_deleted int := 0;
  _snap_deleted int := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF _doc_ids IS NULL OR array_length(_doc_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'award_raw', 0, 'normalized', 0, 'decision_log', 0, 'snapshot', 0);
  END IF;

  WITH d AS (
    DELETE FROM public.credential_mapping_decision_log
    WHERE student_user_id = _uid AND source_document_id = ANY(_doc_ids)
    RETURNING 1
  ) SELECT count(*) INTO _log_deleted FROM d;

  WITH d AS (
    DELETE FROM public.student_credential_normalized
    WHERE student_user_id = _uid AND source_document_id = ANY(_doc_ids)
    RETURNING 1
  ) SELECT count(*) INTO _norm_deleted FROM d;

  WITH d AS (
    DELETE FROM public.student_award_raw
    WHERE student_user_id = _uid AND source_document_id = ANY(_doc_ids)
    RETURNING 1
  ) SELECT count(*) INTO _award_deleted FROM d;

  -- If no normalized rows remain for this user, drop the snapshot too.
  IF NOT EXISTS (
    SELECT 1 FROM public.student_credential_normalized WHERE student_user_id = _uid
  ) THEN
    WITH d AS (
      DELETE FROM public.student_evaluation_snapshots
      WHERE student_user_id = _uid
      RETURNING 1
    ) SELECT count(*) INTO _snap_deleted FROM d;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'award_raw', _award_deleted,
    'normalized', _norm_deleted,
    'decision_log', _log_deleted,
    'snapshot', _snap_deleted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.phase_a_purge_for_documents(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.phase_a_purge_for_documents(uuid[]) TO authenticated;