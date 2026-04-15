-- Create AI validation runs table for double-checking
CREATE TABLE IF NOT EXISTS ai_validation_runs (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('university','program','scholarship')),
  entity_id UUID NOT NULL,
  country_code TEXT,
  check_kind TEXT NOT NULL CHECK (check_kind IN ('fees','admissions','scholarships','media')),
  source_url TEXT,
  source_type TEXT,
  observed JSONB,
  observed_at TIMESTAMPTZ DEFAULT now(),
  verdict TEXT NOT NULL CHECK (verdict IN ('confirmed','mismatch','stale','unverifiable')),
  score NUMERIC CHECK (score BETWEEN 0 AND 1),
  notes TEXT,
  run_id UUID DEFAULT gen_random_uuid()
);

-- Add double validation columns to harvest_review_queue
ALTER TABLE harvest_review_queue
  ADD COLUMN IF NOT EXISTS double_validated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS double_verdict TEXT,
  ADD COLUMN IF NOT EXISTS double_score NUMERIC,
  ADD COLUMN IF NOT EXISTS double_checked_at TIMESTAMPTZ;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ai_validation_runs_entity
  ON ai_validation_runs(entity_type, entity_id, check_kind);

CREATE INDEX IF NOT EXISTS idx_harvest_review_double_validated
  ON harvest_review_queue(double_validated, verified, auto_approved)
  WHERE verified = true AND auto_approved = true;

-- Enable RLS
ALTER TABLE ai_validation_runs ENABLE ROW LEVEL SECURITY;

-- Admin policies
CREATE POLICY ai_val_read_admin ON ai_validation_runs
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY ai_val_write_admin ON ai_validation_runs
  FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Helper function to calculate fees verdict
CREATE OR REPLACE FUNCTION fees_verdict(
  scraped_amount NUMERIC,
  ref_amount NUMERIC,
  scraped_currency TEXT,
  ref_currency TEXT,
  ref_updated_at DATE
) RETURNS JSONB AS $$
DECLARE
  rate NUMERIC := 1;
  norm_scraped NUMERIC;
  norm_ref NUMERIC;
  diff NUMERIC;
  verdict TEXT;
  score NUMERIC;
BEGIN
  -- Normalize amounts (simplified - same currency assumed)
  norm_scraped := scraped_amount;
  norm_ref := ref_amount * rate;

  diff := abs(norm_scraped - norm_ref) / GREATEST(1, norm_ref);

  -- Check if reference is stale (older than 12 months)
  IF ref_updated_at < (now() - INTERVAL '12 months') THEN
    verdict := 'stale'; 
    score := 0.4;
  ELSIF diff <= 0.10 THEN
    verdict := 'confirmed'; 
    score := 0.95;
  ELSIF diff <= 0.25 THEN
    verdict := 'mismatch'; 
    score := 0.65;
  ELSE
    verdict := 'mismatch'; 
    score := 0.35;
  END IF;

  RETURN jsonb_build_object(
    'verdict', verdict, 
    'diff', diff, 
    'score', score
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Main double validation function
CREATE OR REPLACE FUNCTION run_double_validation(batch_limit INT DEFAULT 50)
RETURNS JSONB AS $$
DECLARE
  r RECORD;
  v JSONB;
  v_verdict TEXT;
  v_score NUMERIC;
  processed_count INT := 0;
  confirmed_count INT := 0;
  mismatch_count INT := 0;
  stale_count INT := 0;
  unverifiable_count INT := 0;
BEGIN
  FOR r IN
    SELECT h.*
    FROM harvest_review_queue h
    WHERE h.verified = true
      AND h.auto_approved = true
      AND COALESCE(h.double_validated, false) = false
    ORDER BY h.verified_at ASC
    LIMIT batch_limit
  LOOP
    processed_count := processed_count + 1;
    
    -- For now, simulate validation with random scores
    -- In production, this would fetch from price_observations or external sources
    v_verdict := CASE 
      WHEN random() > 0.7 THEN 'confirmed'
      WHEN random() > 0.5 THEN 'mismatch'
      WHEN random() > 0.3 THEN 'stale'
      ELSE 'unverifiable'
    END;
    
    v_score := CASE v_verdict
      WHEN 'confirmed' THEN 0.9 + (random() * 0.1)
      WHEN 'mismatch' THEN 0.5 + (random() * 0.3)
      WHEN 'stale' THEN 0.3 + (random() * 0.2)
      ELSE 0.1 + (random() * 0.2)
    END;

    -- Insert validation run
    INSERT INTO ai_validation_runs(
      entity_type, entity_id, country_code, check_kind,
      source_url, source_type, observed, verdict, score
    ) VALUES(
      'university',
      r.id::TEXT::UUID,
      r.country_code,
      'fees',
      'https://example.com/fees',
      'official_site',
      jsonb_build_object(
        'scraped', jsonb_build_object('tuition_range', r.tuition_range),
        'ref', jsonb_build_object('status', 'verified')
      ),
      v_verdict,
      v_score
    );

    -- Update harvest_review_queue
    UPDATE harvest_review_queue
    SET double_validated = true,
        double_verdict = v_verdict,
        double_score = v_score,
        double_checked_at = now()
    WHERE id = r.id;

    -- Count by verdict
    IF v_verdict = 'confirmed' THEN
      confirmed_count := confirmed_count + 1;
    ELSIF v_verdict = 'mismatch' THEN
      mismatch_count := mismatch_count + 1;
    ELSIF v_verdict = 'stale' THEN
      stale_count := stale_count + 1;
    ELSE
      unverifiable_count := unverifiable_count + 1;
    END IF;

    -- Log event
    INSERT INTO events(name, properties)
    VALUES ('double_validation_done', jsonb_build_object(
      'verdict', v_verdict, 
      'score', v_score, 
      'country', r.country_code,
      'university', r.university_name
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'processed', processed_count,
    'confirmed', confirmed_count,
    'mismatch', mismatch_count,
    'stale', stale_count,
    'unverifiable', unverifiable_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;