-- Create the domain validation helper function
CREATE OR REPLACE FUNCTION public.is_official_domain_url(p_url TEXT, p_university_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url_host TEXT;
  v_uni_host TEXT;
  v_uni_domain TEXT;
  v_url_domain TEXT;
  v_uni_parts TEXT[];
  v_url_parts TEXT[];
BEGIN
  IF p_url IS NULL OR p_url = '' THEN RETURN FALSE; END IF;
  BEGIN
    v_url_host := lower(split_part(split_part(p_url, '://', 2), '/', 1));
  EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
  END;
  IF v_url_host IS NULL OR v_url_host = '' THEN RETURN FALSE; END IF;
  
  SELECT lower(split_part(split_part(u.website, '://', 2), '/', 1))
  INTO v_uni_host
  FROM universities u
  WHERE u.id = p_university_id AND u.website IS NOT NULL AND u.website != '';
  IF v_uni_host IS NULL THEN RETURN FALSE; END IF;
  
  v_uni_host := regexp_replace(v_uni_host, '^www\.', '');
  v_url_host := regexp_replace(v_url_host, '^www\.', '');
  
  v_uni_parts := string_to_array(v_uni_host, '.');
  v_url_parts := string_to_array(v_url_host, '.');

  IF v_uni_host ~ '\.(ac|co|org|gov|edu)\.[a-z]{2}$' THEN
    v_uni_domain := array_to_string(v_uni_parts[array_length(v_uni_parts,1)-2 : array_length(v_uni_parts,1)], '.');
  ELSE
    v_uni_domain := array_to_string(v_uni_parts[array_length(v_uni_parts,1)-1 : array_length(v_uni_parts,1)], '.');
  END IF;
  
  IF v_url_host ~ '\.(ac|co|org|gov|edu)\.[a-z]{2}$' THEN
    v_url_domain := array_to_string(v_url_parts[array_length(v_url_parts,1)-2 : array_length(v_url_parts,1)], '.');
  ELSE
    v_url_domain := array_to_string(v_url_parts[array_length(v_url_parts,1)-1 : array_length(v_url_parts,1)], '.');
  END IF;
  
  RETURN v_url_domain = v_uni_domain;
END;
$$