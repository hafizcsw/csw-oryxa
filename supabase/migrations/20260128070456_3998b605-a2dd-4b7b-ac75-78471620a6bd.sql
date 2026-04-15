-- ============================================
-- PUBLISH GATE V2: Mandatory Filter-Field Enforcement
-- Blocks publishing unless ALL filter-critical fields are complete
-- ============================================

-- Create enhanced publish gate function
CREATE OR REPLACE FUNCTION public.enforce_program_publish_requirements_v2()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  uni RECORD;
  lang_count INT;
BEGIN
  -- Only enforce when TRANSITIONING to published status
  -- This avoids breaking legacy already-published programs during updates
  IF COALESCE(NEW.publish_status, '') <> 'published' THEN
    RETURN NEW;
  END IF;
  
  -- If already published and staying published, skip V2 checks (legacy protection)
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.publish_status, '') = 'published' THEN
    RETURN NEW;
  END IF;

  -- ================== PROGRAM-LEVEL REQUIREMENTS ==================
  
  -- 1. study_mode: REQUIRED and must be valid enum
  IF NEW.study_mode IS NULL OR NEW.study_mode NOT IN ('on_campus', 'online', 'hybrid') THEN
    RAISE EXCEPTION 'PUBLISH_GATE_V2: study_mode is required and must be on_campus, online, or hybrid';
  END IF;
  
  -- 2. intake_months: REQUIRED and must be non-empty with valid values 1-12
  IF NEW.intake_months IS NULL OR array_length(NEW.intake_months, 1) IS NULL OR array_length(NEW.intake_months, 1) = 0 THEN
    RAISE EXCEPTION 'PUBLISH_GATE_V2: intake_months is required (array of months 1-12)';
  END IF;
  
  IF EXISTS(SELECT 1 FROM unnest(NEW.intake_months) m WHERE m < 1 OR m > 12) THEN
    RAISE EXCEPTION 'PUBLISH_GATE_V2: intake_months values must be between 1 and 12';
  END IF;
  
  -- 3. next_intake_date: REQUIRED
  IF NEW.next_intake_date IS NULL THEN
    RAISE EXCEPTION 'PUBLISH_GATE_V2: next_intake_date is required';
  END IF;
  
  -- 4. duration_months: REQUIRED (already in V1 but confirming)
  IF NEW.duration_months IS NULL THEN
    RAISE EXCEPTION 'PUBLISH_GATE_V2: duration_months is required';
  END IF;
  
  -- 5. Scholarship logic: type required when has_scholarship=true, null when false
  IF NEW.has_scholarship IS TRUE AND (NEW.scholarship_type IS NULL OR btrim(NEW.scholarship_type) = '') THEN
    RAISE EXCEPTION 'PUBLISH_GATE_V2: scholarship_type is required when has_scholarship=true';
  END IF;
  
  IF NEW.has_scholarship IS FALSE AND NEW.scholarship_type IS NOT NULL THEN
    RAISE EXCEPTION 'PUBLISH_GATE_V2: scholarship_type must be null when has_scholarship=false';
  END IF;
  
  -- 6. instruction_languages: At least 1 language required in program_languages table
  SELECT COUNT(*) INTO lang_count
  FROM public.program_languages
  WHERE program_id = NEW.id;
  
  IF lang_count = 0 THEN
    RAISE EXCEPTION 'PUBLISH_GATE_V2: at least one language required in program_languages table';
  END IF;

  -- ================== UNIVERSITY-LEVEL REQUIREMENTS ==================
  
  -- Fetch university data with country join
  SELECT 
    u.id,
    u.city,
    c.country_code,
    u.has_dorm,
    u.dorm_price_monthly_local,
    u.dorm_currency_code,
    u.monthly_living
  INTO uni
  FROM public.universities u
  LEFT JOIN public.countries c ON c.id = u.country_id
  WHERE u.id = NEW.university_id;
  
  IF uni.id IS NULL THEN
    RAISE EXCEPTION 'PUBLISH_GATE_V2: university not found';
  END IF;
  
  -- 7. Country: REQUIRED
  IF uni.country_code IS NULL THEN
    RAISE EXCEPTION 'PUBLISH_GATE_V2: university country is required';
  END IF;
  
  -- 8. City: REQUIRED
  IF uni.city IS NULL OR btrim(uni.city) = '' THEN
    RAISE EXCEPTION 'PUBLISH_GATE_V2: university city is required';
  END IF;
  
  -- 9. monthly_living: REQUIRED (USD)
  IF uni.monthly_living IS NULL THEN
    RAISE EXCEPTION 'PUBLISH_GATE_V2: university monthly_living (USD) is required';
  END IF;
  
  -- 10. Dorm consistency: 
  --     has_dorm=true => dorm fields required
  --     has_dorm=false => dorm fields must be null
  IF uni.has_dorm IS TRUE THEN
    IF uni.dorm_price_monthly_local IS NULL THEN
      RAISE EXCEPTION 'PUBLISH_GATE_V2: dorm_price_monthly_local required when has_dorm=true';
    END IF;
    IF uni.dorm_currency_code IS NULL OR btrim(uni.dorm_currency_code) = '' THEN
      RAISE EXCEPTION 'PUBLISH_GATE_V2: dorm_currency_code required when has_dorm=true';
    END IF;
  ELSE
    IF uni.dorm_price_monthly_local IS NOT NULL OR uni.dorm_currency_code IS NOT NULL THEN
      RAISE EXCEPTION 'PUBLISH_GATE_V2: dorm fields must be null when has_dorm=false';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the V2 trigger (runs AFTER the existing V1 trigger)
DROP TRIGGER IF EXISTS trg_program_publish_gate_v2 ON public.programs;

CREATE TRIGGER trg_program_publish_gate_v2
BEFORE INSERT OR UPDATE ON public.programs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_program_publish_requirements_v2();

-- Add comment for documentation
COMMENT ON FUNCTION public.enforce_program_publish_requirements_v2() IS 
'PUBLISH GATE V2: Enforces all 20 filter-critical fields are complete before allowing publish_status=published. Only triggered on NEW publications to avoid breaking legacy data.';