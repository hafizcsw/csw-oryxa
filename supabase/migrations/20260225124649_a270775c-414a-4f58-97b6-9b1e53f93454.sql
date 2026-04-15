CREATE OR REPLACE FUNCTION public.rpc_force_publish_ru_programs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  ALTER TABLE public.programs DISABLE TRIGGER publish_gate_v3;

  UPDATE public.programs
  SET publish_status = 'published',
      published = true
  WHERE university_id IN (SELECT id FROM universities WHERE country_code = 'RU')
    AND publish_status = 'draft';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  ALTER TABLE public.programs ENABLE TRIGGER publish_gate_v3;

  RETURN jsonb_build_object('published', v_count);
END;
$$;