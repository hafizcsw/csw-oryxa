-- ========== Production (إضافات غير هدّامة) ==========
ALTER TABLE IF EXISTS universities
  ADD COLUMN IF NOT EXISTS hero_image_url text,
  ADD COLUMN IF NOT EXISTS tuition_min numeric,
  ADD COLUMN IF NOT EXISTS tuition_max numeric,
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS last_scraped_at timestamptz;

ALTER TABLE IF EXISTS programs
  ADD COLUMN IF NOT EXISTS program_slug text,
  ADD COLUMN IF NOT EXISTS application_fee numeric,
  ADD COLUMN IF NOT EXISTS degree_level text,
  ADD COLUMN IF NOT EXISTS language text,
  ADD COLUMN IF NOT EXISTS duration_months int,
  ADD COLUMN IF NOT EXISTS intake_months text[],
  ADD COLUMN IF NOT EXISTS requirements text[],
  ADD COLUMN IF NOT EXISTS content_hash text;

ALTER TABLE IF EXISTS scholarships
  ADD COLUMN IF NOT EXISTS eligibility text[],
  ADD COLUMN IF NOT EXISTS content_hash text;

-- ========== Draft Staging ==========
CREATE TABLE IF NOT EXISTS uni_sources (
  id bigserial PRIMARY KEY,
  domain text NOT NULL UNIQUE,
  robots_allowed boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS university_draft (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  name_en text,
  slug text,
  country text NOT NULL,
  country_code text,
  city text,
  logo_url text,
  hero_image_url text,
  ranking int,
  website_url text,
  description text,
  source_urls text[],
  confidence_score numeric,
  content_hash text UNIQUE,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS program_draft (
  id bigserial PRIMARY KEY,
  university_name text NOT NULL,
  title text NOT NULL,
  title_en text,
  program_slug text,
  degree_level text,
  language text,
  duration_months int,
  tuition_fee numeric,
  currency text,
  application_fee numeric,
  intake_months text[],
  requirements text[],
  source_url text,
  confidence_score numeric,
  content_hash text UNIQUE,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scholarship_draft (
  id bigserial PRIMARY KEY,
  university_name text NOT NULL,
  name text NOT NULL,
  coverage text,
  amount numeric,
  currency text,
  deadline text,
  eligibility text[],
  source_url text,
  confidence_score numeric,
  content_hash text UNIQUE,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- فهارس للتسريع
CREATE INDEX IF NOT EXISTS idx_university_draft_status ON university_draft(status);
CREATE INDEX IF NOT EXISTS idx_university_draft_confidence ON university_draft(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_program_draft_status ON program_draft(status);
CREATE INDEX IF NOT EXISTS idx_program_draft_confidence ON program_draft(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_scholarship_draft_status ON scholarship_draft(status);

-- ========== RLS ==========
ALTER TABLE university_draft ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_draft ENABLE ROW LEVEL SECURITY;
ALTER TABLE scholarship_draft ENABLE ROW LEVEL SECURITY;
ALTER TABLE uni_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS draft_read_admin ON university_draft;
DROP POLICY IF EXISTS draft_write_admin ON university_draft;
DROP POLICY IF EXISTS draft_read_admin2 ON program_draft;
DROP POLICY IF EXISTS draft_write_admin2 ON program_draft;
DROP POLICY IF EXISTS draft_read_admin3 ON scholarship_draft;
DROP POLICY IF EXISTS draft_write_admin3 ON scholarship_draft;
DROP POLICY IF EXISTS sources_read_admin ON uni_sources;
DROP POLICY IF EXISTS sources_write_admin ON uni_sources;

CREATE POLICY draft_read_admin ON university_draft FOR SELECT USING (true);
CREATE POLICY draft_write_admin ON university_draft FOR ALL USING (true);
CREATE POLICY draft_read_admin2 ON program_draft FOR SELECT USING (true);
CREATE POLICY draft_write_admin2 ON program_draft FOR ALL USING (true);
CREATE POLICY draft_read_admin3 ON scholarship_draft FOR SELECT USING (true);
CREATE POLICY draft_write_admin3 ON scholarship_draft FOR ALL USING (true);
CREATE POLICY sources_read_admin ON uni_sources FOR SELECT USING (true);
CREATE POLICY sources_write_admin ON uni_sources FOR ALL USING (true);

-- ========== وظيفة دمج (Merge) ==========
CREATE OR REPLACE FUNCTION admin_merge_university_draft(draft_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE 
  r university_draft%ROWTYPE;
  u_id bigint;
BEGIN
  SELECT * INTO r FROM university_draft WHERE id=draft_id;
  IF NOT FOUND THEN 
    RETURN jsonb_build_object('ok', false, 'error', 'draft_not_found'); 
  END IF;

  -- ابحث عن الجامعة القائمة بالاسم
  SELECT id INTO u_id FROM universities 
  WHERE lower(name)=lower(r.name) 
  LIMIT 1;

  IF u_id IS NOT NULL THEN
    -- تحديث الموجود
    UPDATE universities
      SET name_en = COALESCE(r.name_en, name_en),
          slug = COALESCE(r.slug, slug),
          country = COALESCE(r.country, country),
          city = COALESCE(r.city, city),
          logo_url = COALESCE(r.logo_url, logo_url),
          hero_image_url = COALESCE(r.hero_image_url, hero_image_url),
          ranking = COALESCE(r.ranking, ranking),
          location = COALESCE(r.website_url, location),
          description = COALESCE(r.description, description),
          content_hash = r.content_hash,
          last_scraped_at = now(),
          updated_at = now()
      WHERE id = u_id;
  ELSE
    -- إدراج جديد
    INSERT INTO universities (
      name, slug, country, city, logo_url, hero_image_url, 
      ranking, location, description, content_hash, 
      last_scraped_at, created_at, updated_at
    )
    VALUES (
      r.name, COALESCE(r.slug, lower(regexp_replace(r.name, '[^a-zA-Z0-9]+', '-', 'g'))), 
      r.country, r.city, r.logo_url, r.hero_image_url,
      r.ranking, r.website_url, r.description, r.content_hash,
      now(), now(), now()
    );
  END IF;

  -- حذف من draft
  UPDATE university_draft SET status = 'approved' WHERE id=draft_id;
  
  RETURN jsonb_build_object('ok', true, 'university_id', u_id);
END $$;

CREATE OR REPLACE FUNCTION admin_merge_program_draft(draft_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE 
  r program_draft%ROWTYPE; 
  u_id bigint;
  p_id bigint;
BEGIN
  SELECT * INTO r FROM program_draft WHERE id=draft_id;
  IF NOT FOUND THEN 
    RETURN jsonb_build_object('ok', false, 'error', 'draft_not_found'); 
  END IF;

  -- ابحث عن الجامعة
  SELECT id INTO u_id FROM universities 
  WHERE lower(name)=lower(r.university_name) 
  LIMIT 1;
  
  IF u_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'university_not_found');
  END IF;

  -- تحقق من وجود برنامج مماثل
  SELECT id INTO p_id FROM programs
  WHERE university_id = u_id 
    AND lower(title) = lower(r.title)
  LIMIT 1;

  IF p_id IS NOT NULL THEN
    -- تحديث موجود
    UPDATE programs
    SET title_en = COALESCE(r.title_en, title_en),
        program_slug = COALESCE(r.program_slug, program_slug),
        degree_level = COALESCE(r.degree_level, degree_level),
        language = COALESCE(r.language, language),
        duration_months = COALESCE(r.duration_months, duration_months),
        tuition_fee = COALESCE(r.tuition_fee, tuition_fee),
        application_fee = COALESCE(r.application_fee, application_fee),
        intake_months = COALESCE(r.intake_months, intake_months),
        requirements = COALESCE(r.requirements, requirements),
        content_hash = r.content_hash,
        updated_at = now()
    WHERE id = p_id;
  ELSE
    -- إدراج جديد
    INSERT INTO programs (
      university_id, title, title_en, program_slug, degree_level,
      language, duration_months, tuition_fee, application_fee,
      intake_months, requirements, content_hash, created_at, updated_at
    )
    VALUES (
      u_id, r.title, r.title_en, r.program_slug, r.degree_level,
      r.language, r.duration_months, r.tuition_fee, r.application_fee,
      r.intake_months, r.requirements, r.content_hash, now(), now()
    );
  END IF;

  UPDATE program_draft SET status = 'approved' WHERE id=draft_id;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION admin_merge_scholarship_draft(draft_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE 
  r scholarship_draft%ROWTYPE;
  u_id bigint;
  s_id bigint;
BEGIN
  SELECT * INTO r FROM scholarship_draft WHERE id=draft_id;
  IF NOT FOUND THEN 
    RETURN jsonb_build_object('ok', false, 'error', 'draft_not_found'); 
  END IF;

  SELECT id INTO u_id FROM universities 
  WHERE lower(name)=lower(r.university_name) 
  LIMIT 1;

  IF u_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'university_not_found');
  END IF;

  SELECT id INTO s_id FROM scholarships
  WHERE university_id = u_id 
    AND lower(title) = lower(r.name)
  LIMIT 1;

  IF s_id IS NOT NULL THEN
    UPDATE scholarships
    SET amount = COALESCE(r.amount, amount),
        coverage = COALESCE(r.coverage, coverage),
        eligibility = COALESCE(r.eligibility, eligibility),
        content_hash = r.content_hash,
        updated_at = now()
    WHERE id = s_id;
  ELSE
    INSERT INTO scholarships (
      university_id, title, amount, coverage, 
      eligibility, content_hash, created_at, updated_at
    )
    VALUES (
      u_id, r.name, r.amount, r.coverage,
      r.eligibility, r.content_hash, now(), now()
    );
  END IF;

  UPDATE scholarship_draft SET status = 'approved' WHERE id=draft_id;
  RETURN jsonb_build_object('ok', true);
END $$;