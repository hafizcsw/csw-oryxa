
-- ============================================================
-- PUBLISH GATE V3: 20/20 FILTER COMPLETENESS ENFORCEMENT
-- ============================================================
-- Addresses gaps identified:
-- 1. tuition_usd_min/max guarantee when tuition_is_free=false
-- 2. csw_university_guidance row guarantee (via auto-create)
-- 3. Dorm FX rate guarantee for non-USD currencies
-- ============================================================

-- PART A: Auto-create csw_university_guidance row when university is created
-- This ensures every university has a guidance row (with defaults)
CREATE OR REPLACE FUNCTION public.auto_create_university_guidance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.csw_university_guidance (
    university_id,
    csw_star,
    partner_tier,
    do_not_offer,
    priority_score,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    false,           -- default: not a star
    NULL,            -- default: no tier (will show as "untiered")
    false,           -- default: not blocked
    0,               -- default: lowest priority
    now(),
    now()
  )
  ON CONFLICT (university_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-guidance on new universities
DROP TRIGGER IF EXISTS trg_auto_create_guidance ON public.universities;
CREATE TRIGGER trg_auto_create_guidance
  AFTER INSERT ON public.universities
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_university_guidance();

-- PART B: Backfill missing guidance rows for existing universities
INSERT INTO public.csw_university_guidance (
  university_id,
  csw_star,
  partner_tier,
  do_not_offer,
  priority_score,
  created_at,
  updated_at
)
SELECT 
  u.id,
  false,
  NULL,
  false,
  0,
  now(),
  now()
FROM public.universities u
LEFT JOIN public.csw_university_guidance ug ON ug.university_id = u.id
WHERE ug.university_id IS NULL
ON CONFLICT (university_id) DO NOTHING;

-- PART C: Enhanced Publish Gate V3
CREATE OR REPLACE FUNCTION public.enforce_program_publish_requirements_v3()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  uni RECORD;
  lang_count INT;
  month_val INT;
  has_fx BOOLEAN;
  has_dorm_fx BOOLEAN;
  guidance_exists BOOLEAN;
BEGIN
  -- ============= LEGACY PROTECTION =============
  -- Only enforce when TRANSITIONING to published status for FIRST TIME
  IF COALESCE(NEW.publish_status, '') <> 'published' THEN
    RETURN NEW;
  END IF;
  
  -- If already published and staying published, skip V3 checks (legacy protection)
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.publish_status, '') = 'published' THEN
    RETURN NEW;
  END IF;

  -- ============= PROGRAM-LEVEL REQUIREMENTS (V1 inherited) =============
  
  -- university_id: REQUIRED
  IF NEW.university_id IS NULL THEN
    RAISE EXCEPTION 'PUBLISH_GATE_V3: university_id is required';
  END IF;
  
  -- degree_id: REQUIRED (for degree_slug filter)
  IF NEW.degree_id IS NULL THEN
    RAISE EXCEPTION 'PUBLISH_GATE_V3: degree_id is required';
  END IF;
  
  -- discipline_id: REQUIRED (for discipline_slug filter)
  IF NEW.discipline_id IS NULL THEN
    RAISE EXCEPTION 'PUBLISH_GATE_V3: discipline_id is required';
  END IF;
  
  -- duration_months: REQUIRED
  IF NEW.duration_months IS NULL THEN
    RAISE EXCEPTION 'PUBLISH_GATE_V3: duration_months is required';
  END IF;
  
  -- is_active: MUST be true
  IF NEW.is_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PUBLISH_GATE_V3: is_active must be true to publish';
  END IF;

  -- ============= STUDY MODE (V2 inherited) =============
  IF NEW.study_mode IS NULL OR NEW.study_mode NOT IN ('on_campus', 'online', 'hybrid') THEN
    RAISE EXCEPTION 'PUBLISH_GATE_V3: study_mode is required and must be on_campus, online, or hybrid';
  END IF;

  -- ============= INTAKE (V2 inherited) =============
  IF NEW.intake_months IS NULL OR array_length(NEW.intake_months, 1) IS NULL OR array_length(NEW.intake_months, 1) = 0 THEN
    RAISE EXCEPTION 'PUBLISH_GATE_V3: intake_months is required (array of months 1-12)';
  END IF;
  
  FOR month_val IN SELECT unnest(NEW.intake_months)::int LOOP
    IF month_val < 1 OR month_val > 12 THEN
      RAISE EXCEPTION 'PUBLISH_GATE_V3: intake_months values must be between 1 and 12';
    END IF;
  END LOOP;
  
  IF NEW.next_intake_date IS NULL THEN
    RAISE EXCEPTION 'PUBLISH_GATE_V3: next_intake_date is required';
  END IF;

  -- ============= TUITION REQUIREMENTS (V3 NEW - USD GUARANTEE) =============
  IF COALESCE(NEW.tuition_is_free, false) = false THEN
    -- Must have currency_code
    IF NEW.currency_code IS NULL THEN
      RAISE EXCEPTION 'PUBLISH_GATE_V3: currency_code is required for paid programs';
    END IF;
    
    -- Must have local tuition amounts
    IF NEW.tuition_local_min IS NULL OR NEW.tuition_local_max IS NULL THEN
      RAISE EXCEPTION 'PUBLISH_GATE_V3: tuition_local_min and tuition_local_max are required for paid programs';
    END IF;
    
    -- V3 NEW: Must have USD amounts (denormalized columns)
    IF NEW.tuition_usd_min IS NULL OR NEW.tuition_usd_max IS NULL THEN
      RAISE EXCEPTION 'PUBLISH_GATE_V3: tuition_usd_min and tuition_usd_max are required for paid programs (fill via Studio or sync from local+FX)';
    END IF;
    
    -- Non-USD programs must have FX rate
    IF UPPER(NEW.currency_code) <> 'USD' THEN
      SELECT EXISTS(
        SELECT 1 FROM public.fx_rates WHERE currency_code = UPPER(NEW.currency_code)
      ) INTO has_fx;
      
      IF NOT has_fx THEN
        RAISE EXCEPTION 'PUBLISH_GATE_V3: no FX rate for currency % - add rate before publishing', NEW.currency_code;
      END IF;
    END IF;
  END IF;

  -- ============= SCHOLARSHIP CONSISTENCY (V2 inherited) =============
  IF NEW.has_scholarship IS TRUE AND (NEW.scholarship_type IS NULL OR btrim(NEW.scholarship_type) = '') THEN
    RAISE EXCEPTION 'PUBLISH_GATE_V3: scholarship_type is required when has_scholarship=true';
  END IF;
  
  IF NEW.has_scholarship IS FALSE AND NEW.scholarship_type IS NOT NULL THEN
    RAISE EXCEPTION 'PUBLISH_GATE_V3: scholarship_type must be null when has_scholarship=false';
  END IF;

  -- ============= LANGUAGES (V1/V2 inherited) =============
  SELECT COUNT(*) INTO lang_count
  FROM public.program_languages
  WHERE program_id = NEW.id;
  
  IF lang_count = 0 THEN
    RAISE EXCEPTION 'PUBLISH_GATE_V3: at least one language required in program_languages table';
  END IF;

  -- ============= UNIVERSITY-LEVEL REQUIREMENTS =============
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
    RAISE EXCEPTION 'PUBLISH_GATE_V3: university not found';
  END IF;
  
  IF uni.country_code IS NULL THEN
    RAISE EXCEPTION 'PUBLISH_GATE_V3: university country is required';
  END IF;
  
  IF uni.city IS NULL OR btrim(uni.city) = '' THEN
    RAISE EXCEPTION 'PUBLISH_GATE_V3: university city is required';
  END IF;
  
  IF uni.monthly_living IS NULL THEN
    RAISE EXCEPTION 'PUBLISH_GATE_V3: university monthly_living (USD) is required';
  END IF;

  -- ============= DORM CONSISTENCY (V2 inherited + V3 FX CHECK) =============
  IF uni.has_dorm IS TRUE THEN
    IF uni.dorm_price_monthly_local IS NULL THEN
      RAISE EXCEPTION 'PUBLISH_GATE_V3: dorm_price_monthly_local required when has_dorm=true';
    END IF;
    IF uni.dorm_currency_code IS NULL OR btrim(uni.dorm_currency_code) = '' THEN
      RAISE EXCEPTION 'PUBLISH_GATE_V3: dorm_currency_code required when has_dorm=true';
    END IF;
    
    -- V3 NEW: Dorm FX guarantee for non-USD
    IF UPPER(uni.dorm_currency_code) <> 'USD' THEN
      SELECT EXISTS(
        SELECT 1 FROM public.fx_rates WHERE currency_code = UPPER(uni.dorm_currency_code)
      ) INTO has_dorm_fx;
      
      IF NOT has_dorm_fx THEN
        RAISE EXCEPTION 'PUBLISH_GATE_V3: no FX rate for dorm currency % - add rate before publishing', uni.dorm_currency_code;
      END IF;
    END IF;
  ELSE
    IF uni.dorm_price_monthly_local IS NOT NULL OR uni.dorm_currency_code IS NOT NULL THEN
      RAISE EXCEPTION 'PUBLISH_GATE_V3: dorm fields must be null when has_dorm=false';
    END IF;
  END IF;

  -- ============= V3 NEW: GUIDANCE ROW GUARANTEE =============
  SELECT EXISTS(
    SELECT 1 FROM public.csw_university_guidance WHERE university_id = NEW.university_id
  ) INTO guidance_exists;
  
  IF NOT guidance_exists THEN
    RAISE EXCEPTION 'PUBLISH_GATE_V3: csw_university_guidance row required for university (should auto-create, check trigger)';
  END IF;

  RETURN NEW;
END;
$$;

-- Replace V2 trigger with V3
DROP TRIGGER IF EXISTS trg_enforce_program_publish_v2 ON public.programs;
DROP TRIGGER IF EXISTS trg_enforce_program_publish_v3 ON public.programs;

CREATE TRIGGER trg_enforce_program_publish_v3
  BEFORE INSERT OR UPDATE ON public.programs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_program_publish_requirements_v3();

-- ============= DOCUMENTATION COMMENTS =============
COMMENT ON FUNCTION public.enforce_program_publish_requirements_v3() IS 
'PUBLISH GATE V3: Enforces 20/20 filter completeness for new program publications.
Checks: university_id, degree_id, discipline_id, duration_months, is_active, study_mode,
intake_months (1-12), next_intake_date, tuition (free OR local+USD+currency+FX),
scholarship consistency, languages, university country/city/monthly_living,
dorm consistency + FX, and csw_university_guidance row existence.
Legacy protection: skips checks for already-published programs.';

COMMENT ON FUNCTION public.auto_create_university_guidance() IS
'Auto-creates a default csw_university_guidance row when a new university is inserted.
Ensures partner_priority and do_not_offer filters always have a row to reference.';
