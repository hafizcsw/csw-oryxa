-- إضافة أعمدة provenance لتتبع مصدر البيانات من OpenAI
ALTER TABLE harvest_review_queue
  ADD COLUMN IF NOT EXISTS source_provider TEXT DEFAULT 'openai',
  ADD COLUMN IF NOT EXISTS source_model TEXT,
  ADD COLUMN IF NOT EXISTS prompt_version TEXT,
  ADD COLUMN IF NOT EXISTS request_id TEXT,
  ADD COLUMN IF NOT EXISTS prompt_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS usage_tokens JSONB,
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS created_from TEXT DEFAULT 'harvest-worker';

-- إضافة نفس الأعمدة لـ harvest_results
ALTER TABLE harvest_results
  ADD COLUMN IF NOT EXISTS source_provider TEXT DEFAULT 'openai',
  ADD COLUMN IF NOT EXISTS source_model TEXT,
  ADD COLUMN IF NOT EXISTS prompt_version TEXT,
  ADD COLUMN IF NOT EXISTS request_id TEXT,
  ADD COLUMN IF NOT EXISTS usage_tokens JSONB;

-- جدول تتبع منفصل لعمليات AI (للإثبات والتدقيق)
CREATE TABLE IF NOT EXISTS ai_extractions (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'openai',
  model TEXT NOT NULL,
  prompt_version TEXT,
  request_id TEXT,
  prompt_sha256 TEXT,
  usage JSONB,
  entity_type TEXT,
  target_id UUID,
  content_hash TEXT,
  status TEXT DEFAULT 'ok',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_extractions_provider ON ai_extractions (provider, model, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_extractions_entity ON ai_extractions (entity_type, target_id, created_at);

-- تحديث دالة populate_review_queue_from_job لنسخ provenance
CREATE OR REPLACE FUNCTION populate_review_queue_from_job(p_job_id bigint)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  inserted_count INTEGER;
BEGIN
  WITH inserted AS (
    INSERT INTO harvest_review_queue (
      ingestion_id,
      university_name,
      country_code,
      has_tuition,
      has_admissions,
      has_programs,
      tuition_range,
      ai_confidence,
      verified,
      auto_approved,
      source_provider,
      source_model,
      prompt_version,
      request_id,
      usage_tokens
    )
    SELECT 
      gen_random_uuid() as ingestion_id,
      hr.university_name,
      hj.country_code,
      hr.has_official_fees as has_tuition,
      CASE WHEN array_length(hr.admissions_urls, 1) > 0 THEN true ELSE false END as has_admissions,
      false as has_programs,
      NULL as tuition_range,
      CAST(hr.confidence * 100 AS INTEGER) as ai_confidence,
      false as verified,
      false as auto_approved,
      COALESCE(hr.source_provider, 'openai') as source_provider,
      hr.source_model,
      hr.prompt_version,
      hr.request_id,
      hr.usage_tokens
    FROM harvest_results hr
    JOIN harvest_jobs hj ON hj.id = hr.job_id
    WHERE hr.job_id = p_job_id
      AND NOT EXISTS (
        SELECT 1 FROM harvest_review_queue hrq 
        WHERE hrq.university_name = hr.university_name
        AND hrq.country_code = hj.country_code
      )
    RETURNING 1
  )
  SELECT COUNT(*) INTO inserted_count FROM inserted;
  
  RETURN inserted_count;
END;
$function$;

-- إضافة/تحديث feature flags
INSERT INTO feature_settings (key, value) 
VALUES 
  ('feature.harvest_to_review_enabled', 'true'),
  ('feature.fetch_chain_enabled', 'true'),
  ('feature.ai_provenance_tracking', 'true')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;