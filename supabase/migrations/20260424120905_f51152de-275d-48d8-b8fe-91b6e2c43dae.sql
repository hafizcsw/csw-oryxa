DO $$
DECLARE
  _uid uuid := 'ea77d36f-c6c3-4aa9-a4dc-16946e084511';
BEGIN
  DELETE FROM public.credential_mapping_decision_log WHERE student_user_id = _uid;
  DELETE FROM public.student_credential_normalized   WHERE student_user_id = _uid;
  DELETE FROM public.student_award_raw               WHERE student_user_id = _uid;
  DELETE FROM public.student_evaluation_snapshots    WHERE student_user_id = _uid;
END $$;