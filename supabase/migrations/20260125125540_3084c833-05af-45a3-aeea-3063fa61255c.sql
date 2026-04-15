-- Update the publish guard trigger to include ALL SoT requirements
CREATE OR REPLACE FUNCTION public.enforce_program_publish_requirements()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  lang_count INT;
  has_fx BOOLEAN;
BEGIN
  -- Only check when transitioning TO published status
  IF NEW.publish_status = 'published' AND 
     (OLD IS NULL OR OLD.publish_status IS DISTINCT FROM 'published') THEN
    
    -- Must have university
    IF NEW.university_id IS NULL THEN
      RAISE EXCEPTION 'Cannot publish: missing university_id';
    END IF;
    
    -- Must have duration
    IF NEW.duration_months IS NULL THEN
      RAISE EXCEPTION 'Cannot publish: missing duration_months';
    END IF;
    
    -- Must have degree_id (SoT requirement)
    IF NEW.degree_id IS NULL THEN
      RAISE EXCEPTION 'Cannot publish: missing degree_id';
    END IF;
    
    -- Must have discipline_id (SoT requirement)
    IF NEW.discipline_id IS NULL THEN
      RAISE EXCEPTION 'Cannot publish: missing discipline_id';
    END IF;
    
    -- Must have tuition OR be free
    IF COALESCE(NEW.tuition_is_free, false) = false THEN
      -- Must have currency_code AND at least one fee amount
      IF NEW.currency_code IS NULL THEN
        RAISE EXCEPTION 'Cannot publish: missing currency_code for paid program';
      END IF;
      
      IF COALESCE(NEW.tuition_local_min, NEW.tuition_local_max) IS NULL THEN
        RAISE EXCEPTION 'Cannot publish: missing tuition fees (set tuition_is_free=true for free programs)';
      END IF;
    END IF;
    
    -- Must be active
    IF NEW.is_active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Cannot publish: program must be active (is_active=true)';
    END IF;

    -- Must have at least one language in program_languages join table
    SELECT COUNT(*) INTO lang_count
    FROM public.program_languages
    WHERE program_id = NEW.id;

    IF lang_count = 0 THEN
      RAISE EXCEPTION 'Cannot publish: no languages set in program_languages table';
    END IF;
    
    -- Non-USD programs must have FX rate
    IF COALESCE(UPPER(NEW.currency_code), 'USD') <> 'USD' THEN
      SELECT EXISTS(
        SELECT 1 FROM public.fx_rates WHERE currency_code = UPPER(NEW.currency_code)
      ) INTO has_fx;
      
      IF NOT has_fx THEN
        RAISE EXCEPTION 'Cannot publish: no FX rate for currency %', NEW.currency_code;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;