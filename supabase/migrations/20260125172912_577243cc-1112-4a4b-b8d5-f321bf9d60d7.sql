-- ===========================================
-- FIX BLOCKER #1: Country filter consistency
-- FIX BLOCKER #2: Scholarship publish trigger with inference
-- FIX BLOCKER #3: Cleanup bad published scholarships
-- ===========================================

-- BLOCKER #3 FIX: Revert 29 published scholarships with missing amount_type to draft
-- These have amount (legacy) but no amount_type set
UPDATE public.scholarships
SET status = 'draft'
WHERE status = 'published'
AND amount_type IS NULL;

-- BLOCKER #2 FIX: Update trigger to infer amount_type from data
CREATE OR REPLACE FUNCTION public.enforce_scholarship_publish_requirements()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_amount_type text;
  v_amount numeric;
BEGIN
  -- Only check when transitioning TO published status
  IF NEW.status = 'published' AND 
     (OLD IS NULL OR OLD.status IS DISTINCT FROM 'published') THEN
    
    -- Title must exist and not be empty
    IF NEW.title IS NULL OR btrim(NEW.title) = '' THEN
      RAISE EXCEPTION 'Cannot publish scholarship: title is required';
    END IF;
    
    -- Must be active
    IF COALESCE(NEW.is_active, true) = false THEN
      RAISE EXCEPTION 'Cannot publish scholarship: must be active (is_active=true)';
    END IF;
    
    -- INFERENCE LOGIC: Determine effective amount_type from data
    -- Priority: explicit amount_type > infer from percent_value > infer from amount > coverage_type=full
    v_amount_type := NEW.amount_type;
    
    IF v_amount_type IS NULL THEN
      -- Infer from percent_value
      IF NEW.percent_value IS NOT NULL AND NEW.percent_value > 0 THEN
        v_amount_type := 'percent';
      -- Infer from amount_value or legacy amount field
      ELSIF (NEW.amount_value IS NOT NULL AND NEW.amount_value > 0) OR 
            (NEW.amount IS NOT NULL AND NEW.amount > 0) THEN
        v_amount_type := 'fixed';
      -- Infer from coverage_type
      ELSIF NEW.coverage_type = 'full' THEN
        v_amount_type := 'full';
      END IF;
    END IF;
    
    -- Get effective amount (prefer amount_value, fallback to legacy amount)
    v_amount := COALESCE(NEW.amount_value, NEW.amount);
    
    -- Validation based on determined type
    IF v_amount_type = 'fixed' THEN
      IF v_amount IS NULL OR v_amount <= 0 THEN
        RAISE EXCEPTION 'Cannot publish scholarship: fixed type requires amount > 0';
      END IF;
      IF NEW.currency_code IS NULL THEN
        RAISE EXCEPTION 'Cannot publish scholarship: fixed type requires currency_code';
      END IF;
    END IF;
    
    IF v_amount_type = 'percent' THEN
      IF NEW.percent_value IS NULL OR NEW.percent_value < 1 OR NEW.percent_value > 100 THEN
        RAISE EXCEPTION 'Cannot publish scholarship: percent type requires percent_value between 1 and 100';
      END IF;
    END IF;
    
    -- If still no amount_type determined, block publishing
    IF v_amount_type IS NULL THEN
      RAISE EXCEPTION 'Cannot publish scholarship: amount_type must be set or inferable from data (amount, percent_value, or coverage_type=full)';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Make sure trigger is attached
DROP TRIGGER IF EXISTS trg_scholarship_publish_gate ON public.scholarships;
CREATE TRIGGER trg_scholarship_publish_gate
  BEFORE INSERT OR UPDATE ON public.scholarships
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_scholarship_publish_requirements();