-- إضافة حقول country-agnostic للجامعات والبرامج
ALTER TABLE universities
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS page_lang text;

ALTER TABLE program_draft
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS currency_code text,
  ADD COLUMN IF NOT EXISTS fee_as_of_year text,
  ADD COLUMN IF NOT EXISTS fee_captured_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS fee_content_hash text;

-- إضافة حقول evidence
ALTER TABLE harvest_results
  ADD COLUMN IF NOT EXISTS page_lang text,
  ADD COLUMN IF NOT EXISTS currency_detected text,
  ADD COLUMN IF NOT EXISTS academic_year_detected text,
  ADD COLUMN IF NOT EXISTS fee_evidence jsonb DEFAULT '{}';

-- فهارس للأداء
CREATE INDEX IF NOT EXISTS idx_universities_country_code ON universities(country_code) WHERE country_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_program_draft_country_code ON program_draft(country_code) WHERE country_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_program_draft_currency ON program_draft(currency_code) WHERE currency_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_harvest_results_page_lang ON harvest_results(page_lang) WHERE page_lang IS NOT NULL;