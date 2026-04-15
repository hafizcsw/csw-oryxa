-- =====================================================
-- MASTER ORDER: Single Creation Path Enforcement
-- =====================================================

-- 1) RLS on programs table - Admin/Service Role ONLY for writes
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

-- Keep public read (already exists)
-- Add admin-only write policies
CREATE POLICY "programs_admin_insert"
ON public.programs
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "programs_admin_update" 
ON public.programs
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "programs_admin_delete"
ON public.programs
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- 2) RLS on universities table - Admin/Service Role ONLY for writes
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "universities_admin_insert"
ON public.universities
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "universities_admin_update"
ON public.universities
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "universities_admin_delete"
ON public.universities
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- 3) Dorm Data Cleanliness Gate (Trigger)
CREATE OR REPLACE FUNCTION public.enforce_dorm_data_cleanliness()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- If has_dorm = true, require price and currency
  IF COALESCE(NEW.has_dorm, false) = true THEN
    IF NEW.dorm_price_monthly_local IS NULL OR NEW.dorm_price_monthly_local <= 0 THEN
      RAISE EXCEPTION 'has_dorm=true requires dorm_price_monthly_local > 0';
    END IF;
    IF NEW.dorm_currency_code IS NULL OR NEW.dorm_currency_code = '' THEN
      RAISE EXCEPTION 'has_dorm=true requires dorm_currency_code';
    END IF;
  ELSE
    -- If has_dorm = false/null, nullify dorm fields to keep data clean
    NEW.dorm_price_monthly_local := NULL;
    NEW.dorm_currency_code := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply trigger
DROP TRIGGER IF EXISTS trg_enforce_dorm_cleanliness ON public.universities;
CREATE TRIGGER trg_enforce_dorm_cleanliness
  BEFORE INSERT OR UPDATE ON public.universities
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_dorm_data_cleanliness();