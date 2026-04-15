
-- Function to backfill cities from staging table to universities
CREATE OR REPLACE FUNCTION public.rpc_city_backfill_from_staging()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
  v_before integer;
  v_after integer;
BEGIN
  -- Count missing before
  SELECT count(*) INTO v_before FROM universities WHERE city IS NULL AND is_active = true;
  
  -- Update universities where name matches exactly and city is null
  UPDATE universities u
  SET city = c.city
  FROM city_backfill_csv c
  WHERE u.name = c.university_name
    AND u.city IS NULL
    AND u.is_active = true;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  
  -- Count missing after
  SELECT count(*) INTO v_after FROM universities WHERE city IS NULL AND is_active = true;
  
  RETURN jsonb_build_object(
    'updated', v_updated,
    'missing_before', v_before,
    'missing_after', v_after,
    'improvement', v_before - v_after
  );
END;
$$;
