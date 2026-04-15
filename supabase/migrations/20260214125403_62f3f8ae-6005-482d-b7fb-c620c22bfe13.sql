-- Expand program_urls status to include extracting/extracted/done
ALTER TABLE program_urls DROP CONSTRAINT IF EXISTS program_urls_status_check;
ALTER TABLE program_urls ADD CONSTRAINT program_urls_status_check 
  CHECK (status IN ('pending','fetched','failed','skipped','retry','extracting','extracted','done'));