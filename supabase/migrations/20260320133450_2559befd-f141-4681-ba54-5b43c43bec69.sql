-- Drop the unique constraint first
ALTER TABLE universities DROP CONSTRAINT IF EXISTS uq_universities_website_host;
DROP INDEX IF EXISTS uq_universities_website_host;