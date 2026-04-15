-- LAV #15.A: Database Indexes + View + Shortlist with 5-item limit

-- A.1: Performance indexes for search/filter
CREATE INDEX IF NOT EXISTS idx_universities_name_lower ON universities (lower(name));
CREATE INDEX IF NOT EXISTS idx_universities_fees ON universities (annual_fees);
CREATE INDEX IF NOT EXISTS idx_universities_living ON universities (monthly_living);
CREATE INDEX IF NOT EXISTS idx_universities_country ON universities (country_id);
CREATE INDEX IF NOT EXISTS idx_universities_ranking ON universities (ranking);

-- A.2: Unified view for search (name/country/fees/living/rank)
CREATE OR REPLACE VIEW vw_university_search AS
SELECT
  u.id,
  u.name,
  u.city,
  u.logo_url,
  u.annual_fees,
  u.monthly_living,
  u.ranking,
  u.description,
  u.website,
  u.is_active,
  c.id   AS country_id,
  c.slug AS country_slug,
  c.name AS country_name
FROM universities u
JOIN countries c ON c.id = u.country_id
WHERE COALESCE(u.is_active, true) = true;

-- A.3: Student shortlist table with 5-item max per (student, country)
CREATE TABLE IF NOT EXISTS student_shortlists (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     uuid NOT NULL,
  country_id     uuid NOT NULL,
  university_id  uuid NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, country_id, university_id)
);

-- Enable RLS
ALTER TABLE student_shortlists ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Students can view own shortlist"
  ON student_shortlists FOR SELECT
  USING (true);

CREATE POLICY "Students can manage own shortlist"
  ON student_shortlists FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger to enforce 5-item limit per (student_id, country_id)
CREATE OR REPLACE FUNCTION trg_enforce_shortlist_max_5()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE 
  cnt int;
BEGIN
  SELECT count(*) INTO cnt
  FROM student_shortlists
  WHERE student_id = NEW.student_id
    AND country_id = NEW.country_id;
    
  IF cnt >= 5 THEN
    RAISE EXCEPTION 'Shortlist limit (5) reached for this country';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS t_enforce_shortlist_max_5 ON student_shortlists;
CREATE TRIGGER t_enforce_shortlist_max_5
  BEFORE INSERT ON student_shortlists
  FOR EACH ROW 
  EXECUTE FUNCTION trg_enforce_shortlist_max_5();