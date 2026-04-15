-- Publish Gate V3: Constraint function to prevent publishing incomplete programs
-- This trigger validates all required fields before allowing publish_status = 'published'

-- Drop existing function if exists
DROP FUNCTION IF EXISTS validate_program_publish_gate() CASCADE;

-- Create validation function
CREATE OR REPLACE FUNCTION validate_program_publish_gate()
RETURNS TRIGGER AS $$
DECLARE
  missing_fields TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Only validate when transitioning TO 'published' status
  IF NEW.publish_status = 'published' AND (OLD.publish_status IS DISTINCT FROM 'published') THEN
    
    -- Required: title (always present due to NOT NULL)
    
    -- Required: degree_id
    IF NEW.degree_id IS NULL THEN
      missing_fields := array_append(missing_fields, 'MISSING_DEGREE_ID');
    END IF;
    
    -- Required: discipline_id
    IF NEW.discipline_id IS NULL THEN
      missing_fields := array_append(missing_fields, 'MISSING_DISCIPLINE_ID');
    END IF;
    
    -- Required: duration_months
    IF NEW.duration_months IS NULL THEN
      missing_fields := array_append(missing_fields, 'MISSING_DURATION_MONTHS');
    END IF;
    
    -- Required: languages (non-empty array)
    IF NEW.languages IS NULL OR array_length(NEW.languages, 1) IS NULL THEN
      missing_fields := array_append(missing_fields, 'MISSING_LANGUAGES');
    END IF;
    
    -- Required: study_mode
    IF NEW.study_mode IS NULL OR NEW.study_mode NOT IN ('on_campus', 'online', 'hybrid') THEN
      missing_fields := array_append(missing_fields, 'MISSING_OR_INVALID_STUDY_MODE');
    END IF;
    
    -- Required: intake_months (non-empty array)
    IF NEW.intake_months IS NULL OR array_length(NEW.intake_months, 1) IS NULL THEN
      missing_fields := array_append(missing_fields, 'MISSING_INTAKE_MONTHS');
    END IF;
    
    -- Required: next_intake_date
    IF NEW.next_intake_date IS NULL THEN
      missing_fields := array_append(missing_fields, 'MISSING_NEXT_INTAKE_DATE');
    END IF;
    
    -- Tuition validation: if not free, must have amount + basis + scope
    IF NEW.tuition_is_free IS NOT TRUE THEN
      IF NEW.tuition_usd_min IS NULL AND NEW.tuition_usd_max IS NULL THEN
        missing_fields := array_append(missing_fields, 'MISSING_TUITION_AMOUNT');
      END IF;
      
      IF NEW.tuition_basis IS NULL THEN
        missing_fields := array_append(missing_fields, 'MISSING_TUITION_BASIS');
      END IF;
      
      IF NEW.tuition_scope IS NULL THEN
        missing_fields := array_append(missing_fields, 'MISSING_TUITION_SCOPE');
      END IF;
    END IF;
    
    -- If any missing fields, reject the publish
    IF array_length(missing_fields, 1) > 0 THEN
      RAISE EXCEPTION 'PUBLISH_GATE_V3_FAILED: Program cannot be published. Missing fields: %', 
        array_to_string(missing_fields, ', ')
        USING ERRCODE = 'P0001';
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_validate_program_publish ON programs;

CREATE TRIGGER trg_validate_program_publish
  BEFORE UPDATE ON programs
  FOR EACH ROW
  EXECUTE FUNCTION validate_program_publish_gate();

-- Also apply on INSERT (for direct inserts with publish_status = 'published')
CREATE OR REPLACE FUNCTION validate_program_publish_gate_insert()
RETURNS TRIGGER AS $$
DECLARE
  missing_fields TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Only validate if inserting with 'published' status
  IF NEW.publish_status = 'published' THEN
    
    IF NEW.degree_id IS NULL THEN
      missing_fields := array_append(missing_fields, 'MISSING_DEGREE_ID');
    END IF;
    
    IF NEW.discipline_id IS NULL THEN
      missing_fields := array_append(missing_fields, 'MISSING_DISCIPLINE_ID');
    END IF;
    
    IF NEW.duration_months IS NULL THEN
      missing_fields := array_append(missing_fields, 'MISSING_DURATION_MONTHS');
    END IF;
    
    IF NEW.languages IS NULL OR array_length(NEW.languages, 1) IS NULL THEN
      missing_fields := array_append(missing_fields, 'MISSING_LANGUAGES');
    END IF;
    
    IF NEW.study_mode IS NULL OR NEW.study_mode NOT IN ('on_campus', 'online', 'hybrid') THEN
      missing_fields := array_append(missing_fields, 'MISSING_OR_INVALID_STUDY_MODE');
    END IF;
    
    IF NEW.intake_months IS NULL OR array_length(NEW.intake_months, 1) IS NULL THEN
      missing_fields := array_append(missing_fields, 'MISSING_INTAKE_MONTHS');
    END IF;
    
    IF NEW.next_intake_date IS NULL THEN
      missing_fields := array_append(missing_fields, 'MISSING_NEXT_INTAKE_DATE');
    END IF;
    
    IF NEW.tuition_is_free IS NOT TRUE THEN
      IF NEW.tuition_usd_min IS NULL AND NEW.tuition_usd_max IS NULL THEN
        missing_fields := array_append(missing_fields, 'MISSING_TUITION_AMOUNT');
      END IF;
      IF NEW.tuition_basis IS NULL THEN
        missing_fields := array_append(missing_fields, 'MISSING_TUITION_BASIS');
      END IF;
      IF NEW.tuition_scope IS NULL THEN
        missing_fields := array_append(missing_fields, 'MISSING_TUITION_SCOPE');
      END IF;
    END IF;
    
    IF array_length(missing_fields, 1) > 0 THEN
      RAISE EXCEPTION 'PUBLISH_GATE_V3_FAILED: Program cannot be published. Missing fields: %', 
        array_to_string(missing_fields, ', ')
        USING ERRCODE = 'P0001';
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_program_publish_insert ON programs;

CREATE TRIGGER trg_validate_program_publish_insert
  BEFORE INSERT ON programs
  FOR EACH ROW
  EXECUTE FUNCTION validate_program_publish_gate_insert();

-- Add comment for documentation
COMMENT ON FUNCTION validate_program_publish_gate() IS 
'Publish Gate V3: Validates all required fields before allowing a program to be published. 
Required fields: degree_id, discipline_id, duration_months, languages[], study_mode, intake_months[], next_intake_date.
For paid programs: tuition_usd_min/max, tuition_basis, tuition_scope.';

-- Revoke execute from public to prevent bypassing
REVOKE EXECUTE ON FUNCTION validate_program_publish_gate() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION validate_program_publish_gate_insert() FROM PUBLIC;