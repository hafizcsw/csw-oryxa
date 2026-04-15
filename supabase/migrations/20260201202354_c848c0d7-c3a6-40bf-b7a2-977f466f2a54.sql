-- ============================================
-- BATCH CRAWL SYSTEM - Database Migration
-- ============================================

-- Enable pgcrypto for digest function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- 1. NEW TABLES
-- ============================================

-- crawl_batches: Track batch operations
CREATE TABLE IF NOT EXISTS crawl_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT DEFAULT 'pending' 
    CHECK (status IN ('pending','websites','discovery','fetching','extracting','verifying','ready','publishing','done','failed')),
  rank_start INTEGER,
  rank_end INTEGER,
  universities_count INTEGER DEFAULT 0,
  programs_discovered INTEGER DEFAULT 0,
  programs_extracted INTEGER DEFAULT 0,
  programs_auto_ready INTEGER DEFAULT 0,
  programs_quick_review INTEGER DEFAULT 0,
  programs_deep_review INTEGER DEFAULT 0,
  programs_published INTEGER DEFAULT 0,
  error_log JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

ALTER TABLE crawl_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin access to crawl_batches" ON crawl_batches
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- crawl_batch_universities: Link universities to batches
CREATE TABLE IF NOT EXISTS crawl_batch_universities (
  batch_id UUID REFERENCES crawl_batches(id) ON DELETE CASCADE,
  university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
  PRIMARY KEY (batch_id, university_id)
);

ALTER TABLE crawl_batch_universities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin access to crawl_batch_universities" ON crawl_batch_universities
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- raw_pages: Store fetched page content separately
CREATE TABLE IF NOT EXISTS raw_pages (
  id BIGSERIAL PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  university_id UUID REFERENCES universities(id),
  status_code INT,
  content_type TEXT,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  etag TEXT,
  last_modified TEXT,
  body_sha256 TEXT,
  text_content TEXT,
  fetch_attempts INT DEFAULT 0,
  fetch_error TEXT,
  needs_render BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_raw_pages_fetched ON raw_pages(fetched_at);
CREATE INDEX IF NOT EXISTS idx_raw_pages_university ON raw_pages(university_id);

ALTER TABLE raw_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin access to raw_pages" ON raw_pages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- program_urls: Discovered program URLs
CREATE TABLE IF NOT EXISTS program_urls (
  id BIGSERIAL PRIMARY KEY,
  university_id UUID REFERENCES universities(id),
  batch_id UUID REFERENCES crawl_batches(id),
  url TEXT NOT NULL,
  canonical_url TEXT,
  url_hash TEXT,
  kind TEXT DEFAULT 'program' 
    CHECK (kind IN ('program','fees','admissions','catalog','unknown')),
  discovered_from TEXT,
  status TEXT DEFAULT 'pending' 
    CHECK (status IN ('pending','fetched','failed','skipped','retry')),
  raw_page_id BIGINT REFERENCES raw_pages(id),
  fetch_error TEXT,
  retry_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(university_id, canonical_url)
);

CREATE INDEX IF NOT EXISTS idx_program_urls_batch_status ON program_urls(batch_id, status);
CREATE INDEX IF NOT EXISTS idx_program_urls_kind ON program_urls(kind);

ALTER TABLE program_urls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin access to program_urls" ON program_urls
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- program_related_urls: Link programs to fees/admissions pages
CREATE TABLE IF NOT EXISTS program_related_urls (
  program_draft_id BIGINT REFERENCES program_draft(id) ON DELETE CASCADE,
  program_url_id BIGINT REFERENCES program_urls(id) ON DELETE CASCADE,
  rel TEXT CHECK (rel IN ('fees','admissions','apply','faculty','catalog')),
  PRIMARY KEY (program_draft_id, program_url_id, rel)
);

ALTER TABLE program_related_urls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin access to program_related_urls" ON program_related_urls
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 2. ALTER EXISTING TABLES
-- ============================================

-- program_draft: Add pipeline columns
ALTER TABLE program_draft
  ADD COLUMN IF NOT EXISTS batch_id UUID,
  ADD COLUMN IF NOT EXISTS university_id UUID,
  ADD COLUMN IF NOT EXISTS raw_page_id BIGINT,
  ADD COLUMN IF NOT EXISTS source_program_url TEXT,
  ADD COLUMN IF NOT EXISTS extracted_json JSONB,
  ADD COLUMN IF NOT EXISTS verification_result JSONB,
  ADD COLUMN IF NOT EXISTS missing_fields TEXT[],
  ADD COLUMN IF NOT EXISTS flags TEXT[],
  ADD COLUMN IF NOT EXISTS final_confidence NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS approval_tier TEXT,
  ADD COLUMN IF NOT EXISTS gpt5_reasoning TEXT,
  ADD COLUMN IF NOT EXISTS fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS published_program_id UUID,
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

-- Add FK constraints
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'program_draft_batch_id_fkey') THEN
    ALTER TABLE program_draft ADD CONSTRAINT program_draft_batch_id_fkey 
      FOREIGN KEY (batch_id) REFERENCES crawl_batches(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'program_draft_university_id_fkey') THEN
    ALTER TABLE program_draft ADD CONSTRAINT program_draft_university_id_fkey 
      FOREIGN KEY (university_id) REFERENCES universities(id);
  END IF;
END $$;

-- Idempotency index
CREATE UNIQUE INDEX IF NOT EXISTS uq_draft_uni_url 
ON program_draft(university_id, source_program_url) WHERE source_program_url IS NOT NULL;

-- Performance index
CREATE INDEX IF NOT EXISTS idx_draft_batch_tier ON program_draft(batch_id, approval_tier);

-- source_evidence: Add pipeline columns
ALTER TABLE source_evidence
  ADD COLUMN IF NOT EXISTS program_draft_id BIGINT,
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS tuition_basis TEXT,
  ADD COLUMN IF NOT EXISTS tuition_scope TEXT,
  ADD COLUMN IF NOT EXISTS extractor TEXT DEFAULT 'gemini-flash';

-- Multiple sources per field, unique per source
CREATE UNIQUE INDEX IF NOT EXISTS uq_evidence_draft_field_url 
ON source_evidence(program_draft_id, field, source_url) WHERE program_draft_id IS NOT NULL;

-- programs: Add dedup + tuition metadata columns
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS source_program_url TEXT,
  ADD COLUMN IF NOT EXISTS tuition_basis TEXT,
  ADD COLUMN IF NOT EXISTS tuition_scope TEXT;

-- Fingerprint unique index for idempotent upsert
CREATE UNIQUE INDEX IF NOT EXISTS uq_programs_fingerprint 
ON programs(fingerprint) WHERE fingerprint IS NOT NULL;

-- universities: Add crawl tracking columns
ALTER TABLE universities
  ADD COLUMN IF NOT EXISTS crawl_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS crawl_stage INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS crawl_last_attempt TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS crawl_error TEXT,
  ADD COLUMN IF NOT EXISTS programs_page_urls TEXT[];

-- ============================================
-- 3. RPC FUNCTION: Publish Program Batch
-- ============================================

CREATE OR REPLACE FUNCTION rpc_publish_program_batch(
  p_batch_id UUID, 
  p_mode TEXT DEFAULT 'auto_only'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_published INT := 0;
  v_skipped INT := 0;
  v_errors JSONB := '[]'::jsonb;
  r RECORD;
  v_fingerprint TEXT;
  v_program_id UUID;
  v_degree_id UUID;
  v_discipline_id UUID;
  v_languages TEXT[];
  v_evidence RECORD;
  v_study_mode TEXT;
  v_tuition_amount NUMERIC;
BEGIN
  FOR r IN
    SELECT d.*, d.university_id as uni_id
    FROM program_draft d
    WHERE d.batch_id = p_batch_id
      AND d.published_program_id IS NULL
      AND d.university_id IS NOT NULL
      AND (
        (p_mode = 'auto_only' AND d.approval_tier = 'auto')
        OR
        (p_mode = 'auto_plus_quick' AND d.approval_tier IN ('auto','quick'))
      )
  LOOP
    BEGIN
      -- 1. Calculate fingerprint
      v_study_mode := COALESCE(r.extracted_json->>'study_mode', 'on_campus');
      v_fingerprint := encode(digest(
        r.uni_id::text || '|' ||
        lower(trim(COALESCE(r.title, ''))) || '|' ||
        COALESCE(r.degree_level, '') || '|' ||
        v_study_mode || '|' ||
        COALESCE(regexp_replace(r.source_program_url, '^https?://[^/]+', ''), '')
      , 'sha256'), 'hex');
      
      -- 2. Map degree_level to degree_id
      SELECT id INTO v_degree_id 
      FROM degrees 
      WHERE slug = lower(COALESCE(r.degree_level, ''))
      LIMIT 1;
      
      -- 3. Get discipline_id from verification_result
      v_discipline_id := NULLIF(r.verification_result->>'discipline_id', '')::uuid;
      
      -- 4. Get primary evidence for tuition
      SELECT * INTO v_evidence
      FROM source_evidence
      WHERE program_draft_id = r.id AND field = 'tuition' AND is_primary = true
      LIMIT 1;
      
      -- 5. Build languages array
      v_languages := CASE 
        WHEN r.language IS NOT NULL THEN ARRAY[r.language]
        WHEN r.extracted_json->'languages' IS NOT NULL THEN 
          ARRAY(SELECT jsonb_array_elements_text(r.extracted_json->'languages'))
        ELSE ARRAY['en']
      END;
      
      -- 6. Get tuition amount (only if basis and scope are known)
      v_tuition_amount := CASE 
        WHEN v_evidence.tuition_basis IS NOT NULL 
             AND v_evidence.tuition_basis != 'unknown'
             AND v_evidence.tuition_scope IS NOT NULL 
             AND v_evidence.tuition_scope != 'unknown'
        THEN (r.extracted_json->'tuition'->>'amount')::numeric
        ELSE NULL
      END;
      
      -- 7. UPSERT into programs
      INSERT INTO programs (
        university_id, title, degree_id, discipline_id,
        duration_months, study_mode, teaching_language, languages,
        tuition_usd_min, tuition_usd_max, tuition_is_free,
        tuition_basis, tuition_scope, currency_code,
        ielts_min_overall, gpa_min, prep_year_required,
        source_program_url, fingerprint,
        publish_status, is_active
      ) VALUES (
        r.uni_id, r.title, v_degree_id, v_discipline_id,
        r.duration_months, 
        v_study_mode,
        COALESCE(r.language, v_languages[1]),
        v_languages,
        v_tuition_amount,
        v_tuition_amount,
        COALESCE((r.extracted_json->'tuition'->>'is_free')::boolean, false),
        v_evidence.tuition_basis, 
        v_evidence.tuition_scope,
        r.currency,
        (r.extracted_json->'requirements'->>'ielts_overall')::numeric,
        (r.extracted_json->'requirements'->>'gpa')::numeric,
        (r.extracted_json->'requirements'->>'prep_year_required')::boolean,
        r.source_program_url, 
        v_fingerprint,
        'published', 
        true
      )
      ON CONFLICT (fingerprint) WHERE fingerprint IS NOT NULL
      DO UPDATE SET
        title = EXCLUDED.title,
        duration_months = EXCLUDED.duration_months,
        tuition_usd_min = EXCLUDED.tuition_usd_min,
        tuition_usd_max = EXCLUDED.tuition_usd_max,
        tuition_basis = EXCLUDED.tuition_basis,
        tuition_scope = EXCLUDED.tuition_scope,
        updated_at = NOW()
      RETURNING id INTO v_program_id;
      
      -- 8. UPSERT program_languages
      INSERT INTO program_languages (program_id, language_code)
      SELECT v_program_id, unnest(v_languages)
      ON CONFLICT DO NOTHING;
      
      -- 9. Update draft
      UPDATE program_draft
      SET fingerprint = v_fingerprint,
          published_program_id = v_program_id,
          status = 'published'
      WHERE id = r.id;
      
      v_published := v_published + 1;
      
    EXCEPTION WHEN others THEN
      v_skipped := v_skipped + 1;
      v_errors := v_errors || jsonb_build_object(
        'draft_id', r.id,
        'error', SQLERRM
      );
    END;
  END LOOP;
  
  -- Update batch counters
  UPDATE crawl_batches
  SET programs_published = programs_published + v_published,
      status = CASE WHEN v_published > 0 THEN 'done' ELSE status END,
      finished_at = CASE WHEN v_published > 0 THEN NOW() ELSE finished_at END
  WHERE id = p_batch_id;
  
  RETURN jsonb_build_object(
    'published', v_published, 
    'skipped', v_skipped,
    'errors', v_errors
  );
END;
$$;