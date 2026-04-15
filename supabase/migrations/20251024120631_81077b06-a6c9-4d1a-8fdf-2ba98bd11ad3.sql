-- إضافة حقول اقتراحات الذكاء الاصطناعي
ALTER TABLE harvest_review_queue
  ADD COLUMN IF NOT EXISTS ai_recommendation TEXT,
  ADD COLUMN IF NOT EXISTS ai_confidence INTEGER,
  ADD COLUMN IF NOT EXISTS ai_reasons TEXT[],
  ADD COLUMN IF NOT EXISTS ai_concerns TEXT[],
  ADD COLUMN IF NOT EXISTS ai_suggested_at TIMESTAMPTZ;

-- فهرس لتسريع البحث
CREATE INDEX IF NOT EXISTS ix_review_ai_recommendation ON harvest_review_queue(ai_recommendation);
CREATE INDEX IF NOT EXISTS ix_review_ai_confidence ON harvest_review_queue(ai_confidence DESC);