
-- Fix 1: Currency misassignment in program_draft
-- TRY records are actually RUB (avg ~119k which makes sense for RUB, not TRY)
UPDATE program_draft 
SET currency = 'RUB', currency_code = 'RUB'
WHERE country_code = 'RU' AND currency = 'TRY';

-- USD with code RUB: the fee values (avg ~2811) look like USD amounts, keep currency as USD but fix code
UPDATE program_draft 
SET currency_code = 'USD'
WHERE country_code = 'RU' AND currency = 'USD' AND currency_code = 'RUB';

-- RUB with code USD: the fee values (avg ~113k) are clearly RUB amounts
UPDATE program_draft 
SET currency_code = 'RUB'
WHERE country_code = 'RU' AND currency = 'RUB' AND currency_code = 'USD';

-- Fix 2: Same fixes in published programs table
UPDATE programs p
SET currency_code = 'RUB'
WHERE p.id IN (
  SELECT pd.published_program_id FROM program_draft pd 
  WHERE pd.country_code = 'RU' AND pd.published_program_id IS NOT NULL
) AND p.currency_code != 'RUB'
AND EXISTS (
  SELECT 1 FROM universities u WHERE u.id = p.university_id AND u.country_code = 'RU'
);
