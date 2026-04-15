-- إضافة حقل reason في harvest_results لتوضيح سبب عدم التأهيل
ALTER TABLE harvest_results
  ADD COLUMN IF NOT EXISTS reason text;

-- إضافة فهرس لتسريع البحث
CREATE INDEX IF NOT EXISTS idx_harvest_results_reason ON harvest_results(reason) WHERE reason IS NOT NULL;