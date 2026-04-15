
CREATE OR REPLACE FUNCTION admin_bulk_update_cities(
  p_names text[],
  p_cities text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int := 0;
  v_not_found int := 0;
  v_already_has_city int := 0;
  v_total int := array_length(p_names, 1);
  v_id uuid;
  v_existing_city text;
BEGIN
  FOR i IN 1..v_total LOOP
    SELECT u.id, u.city INTO v_id, v_existing_city
    FROM universities u
    WHERE lower(u.name) = lower(trim(p_names[i]))
    LIMIT 1;

    IF v_id IS NULL THEN
      v_not_found := v_not_found + 1;
      CONTINUE;
    END IF;

    IF v_existing_city IS NOT NULL AND trim(v_existing_city) != '' THEN
      v_already_has_city := v_already_has_city + 1;
      CONTINUE;
    END IF;

    UPDATE universities SET city = trim(p_cities[i]) WHERE id = v_id;
    v_updated := v_updated + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'total', v_total,
    'updated', v_updated,
    'not_found', v_not_found,
    'already_has_city', v_already_has_city
  );
END;
$$;
