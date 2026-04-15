-- =====================================================
-- SCHOLARSHIPS MVP: SoT View + Publish Gate + RLS Cleanup
-- =====================================================

-- 1) Add missing columns to scholarships (IF NOT EXISTS pattern)
DO $$ 
BEGIN
  -- is_active column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema='public' AND table_name='scholarships' AND column_name='is_active') THEN
    ALTER TABLE public.scholarships ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
  
  -- percent_value column  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema='public' AND table_name='scholarships' AND column_name='percent_value') THEN
    ALTER TABLE public.scholarships ADD COLUMN percent_value numeric NULL;
  END IF;
  
  -- degree_slug column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema='public' AND table_name='scholarships' AND column_name='degree_slug') THEN
    ALTER TABLE public.scholarships ADD COLUMN degree_slug text NULL;
  END IF;
  
  -- program_id column (optional link)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema='public' AND table_name='scholarships' AND column_name='program_id') THEN
    ALTER TABLE public.scholarships ADD COLUMN program_id uuid NULL;
  END IF;
END $$;

-- 2) Create vw_scholarship_search_api (SoT for scholarships)
CREATE OR REPLACE VIEW public.vw_scholarship_search_api AS
SELECT
  s.id AS scholarship_id,
  s.title,
  s.description,
  s.status,
  COALESCE(s.is_active, true) AS is_active,
  
  -- University info
  s.university_id,
  u.name AS university_name,
  u.logo_url AS university_logo,
  
  -- Country info (from scholarship or university)
  COALESCE(s.country_id, u.country_id) AS country_id,
  COALESCE(s.country_code, c.country_code) AS country_code,
  c.name_ar AS country_name_ar,
  c.name_en AS country_name_en,
  c.slug AS country_slug,
  
  -- Degree info
  s.degree_id,
  COALESCE(s.degree_slug, s.degree_level, d.slug) AS degree_slug,
  COALESCE(d.name, s.degree_level) AS degree_name,
  s.study_level,
  
  -- Amount info with normalization
  COALESCE(s.amount_type, 
    CASE 
      WHEN s.coverage_type = 'full' THEN 'full'
      WHEN s.amount IS NOT NULL AND s.amount > 0 THEN 'fixed'
      ELSE 'partial'
    END
  ) AS amount_type,
  COALESCE(s.amount_value, s.amount) AS amount_value,
  s.percent_value,
  s.currency_code,
  s.coverage_type,
  s.coverage,
  
  -- Application info
  s.deadline,
  COALESCE(s.link, s.url, s.application_url) AS link,
  s.eligibility,
  
  -- Metadata
  s.source,
  s.source_name,
  s.provider,
  s.academic_year,
  s.created_at,
  s.updated_at,
  s.image_url,
  s.beneficiaries_count,
  s.acceptance_rate,
  s.rating

FROM public.scholarships s
LEFT JOIN public.universities u ON u.id = s.university_id
LEFT JOIN public.countries c ON c.id = COALESCE(s.country_id, u.country_id)
LEFT JOIN public.degrees d ON d.id = s.degree_id;

-- 3) Create Publish Gate trigger for scholarships
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
    
    -- Determine effective amount_type
    v_amount_type := COALESCE(NEW.amount_type, 
      CASE 
        WHEN NEW.coverage_type = 'full' THEN 'full'
        WHEN NEW.amount IS NOT NULL AND NEW.amount > 0 THEN 'fixed'
        ELSE NULL
      END
    );
    v_amount := COALESCE(NEW.amount_value, NEW.amount);
    
    -- If fixed, must have amount and currency
    IF v_amount_type = 'fixed' THEN
      IF v_amount IS NULL OR v_amount <= 0 THEN
        RAISE EXCEPTION 'Cannot publish scholarship: fixed type requires amount > 0';
      END IF;
      IF NEW.currency_code IS NULL THEN
        RAISE EXCEPTION 'Cannot publish scholarship: fixed type requires currency_code';
      END IF;
    END IF;
    
    -- If percent, must have valid percent_value
    IF v_amount_type = 'percent' THEN
      IF NEW.percent_value IS NULL OR NEW.percent_value < 1 OR NEW.percent_value > 100 THEN
        RAISE EXCEPTION 'Cannot publish scholarship: percent type requires percent_value between 1 and 100';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_enforce_scholarship_publish ON public.scholarships;
CREATE TRIGGER trg_enforce_scholarship_publish
  BEFORE INSERT OR UPDATE ON public.scholarships
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_scholarship_publish_requirements();

-- 4) Clean up redundant RLS policies on scholarships
DROP POLICY IF EXISTS "sch_select_all" ON public.scholarships;
DROP POLICY IF EXISTS "sch_select_public" ON public.scholarships;

-- Ensure proper public read policy exists (published only)
DROP POLICY IF EXISTS "scholarships_public_read" ON public.scholarships;
CREATE POLICY "scholarships_public_read" ON public.scholarships
  FOR SELECT TO public
  USING (status = 'published' AND COALESCE(is_active, true) = true);

-- Ensure admin can see all (including drafts)
DROP POLICY IF EXISTS "scholarships_admin_all" ON public.scholarships;
CREATE POLICY "scholarships_admin_all" ON public.scholarships
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- 5) Grant access to view
GRANT SELECT ON public.vw_scholarship_search_api TO anon, authenticated;